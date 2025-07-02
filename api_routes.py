import os
from flask import Blueprint, jsonify, request, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import boto3
from botocore.client import Config
from botocore.exceptions import NoCredentialsError, ClientError

from models import User
from db import get_db


api_routes = Blueprint('api_routes', __name__)


def get_s3_client():
    """
    Creates a new S3 client for each request. Otherwise, if caching a request, there's a risk
    that the credentials expire. Handles both local development (using AWS_PROFILE) and deployed
    (using IAM Role) scenarios.
    """
    region_name = current_app.config.get('AWS_REGION')

    return boto3.client(
        's3',
        region_name=region_name,
        config=Config(signature_version='s3v4')  # Explicitly use v4 signatures
    )


@api_routes.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"message": "Email and password are required."}), 400

    conn = get_db()

    try:
        existing_user = User.get_by_email(conn, email)
        if existing_user:
            # The message is kept generic to prevent user enumeration.
            return jsonify({"message": "An account with this email may already exist."}), 409

        password_hash = generate_password_hash(password)
        new_user = User.create(conn, email, password_hash)
        conn.commit()

        login_user(new_user)  # Log the new user in, setting the HttpOnly session cookie.
        return jsonify({"message": "Signup successful.", "user": {"email": new_user.email}}), 201
    
    except psycopg2.Error as e:
        current_app.logger.error(f"Database error during signup: {e}")
        return jsonify({"message": "A database error occurred during signup."}), 500
    
    except Exception as e:
        current_app.logger.error(f"Unexpected error during signup: {e}")
        return jsonify({"message": "An internal error occurred."}), 500


@api_routes.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    conn = get_db()
    user = User.get_by_email(conn, email)

    # Use a generic error message to prevent user enumeration attacks.
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid email or password."}), 401

    login_user(user) # This sets the secure HttpOnly session cookie.
    return jsonify({"message": "Login successful.", "user": {"email": user.email}}), 200


@api_routes.route('/api/logout', methods=['POST'])
@login_required # Ensures only logged-in users can log out.
def logout():
    logout_user() # This clears the session cookie.
    return jsonify({"message": "Logout successful."}), 200


@api_routes.route('/api/check-auth')
@login_required # if the session cookie is invalid/missing, this fails.
def check_auth():
    # If the request reaches here, the user is authenticated.
    return jsonify({"message": "User is authenticated.", "user": {"email": current_user.email}}), 200


# routes for video streaming
# ----------------------------------------------------------------------------
@api_routes.route('/api/videos', methods=['GET'])
@login_required
def list_videos():
    """
    Lists videos available in the S3 bucket.
    """
    s3 = get_s3_client()
    bucket_name = current_app.config.get('S3_BUCKET_NAME')

    assets = dict()
    video_extensions = ('.mp4', '.mov', '.avi', '.mkv')
    thumb_extensions = ('.png', '.jpg', '.jpeg')

    try:
        response = s3.list_objects_v2(Bucket=bucket_name)

        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                name, ext = os.path.splitext(key)
                ext = ext.lower()

                if name not in assets:
                    assets[name] = dict()

                if ext in video_extensions:
                    assets[name]['video'] = {'key': key, 'size': obj['Size']}

                elif ext in thumb_extensions:
                    assets[name]['thumbnail'] = {'key': key}

                elif ext == '.txt':
                    try:
                        label_obj = s3.get_object(Bucket=bucket_name, Key=key)
                        label_content = label_obj['Body'].read().decode('utf-8').strip()
                        assets[name]['label'] = label_content

                    except Exception as e:
                        current_app.logger.error(f"Could not read label file {key}: {e}")
                
            videos = []

            for name, data in assets.items():
                if 'video' not in data:
                    continue

                video_info = {
                    'key': data['video']['key'],
                    'size': data['video']['size'],
                    'thumbnail_url': None,
                    'label': name,
                }

                if 'thumbnail' in data:
                    tkey = data['thumbnail']['key']

                    try:
                        turl = s3.generate_presigned_url(
                            'get_object',
                            Params={'Bucket': bucket_name, 'Key': tkey},
                            ExpiresIn=3600
                        )

                        video_info['thumbnail_url'] = turl

                    except ClientError as e:
                        current_app.logger.error(f"Could not generate presigned URL for thumbnail {tkey}: {e}")

                if 'label' in data:
                    video_info['label'] = data['label']

                videos.append(video_info)

            # videos = [{'key': obj['Key'], 'size': obj['Size']} for obj in response['Contents']]
            return jsonify(videos), 200
        else:
            return jsonify([]), 200  # Empty bucket
        
    except NoCredentialsError:
        current_app.logger.error("AWS credentials not found")
        return jsonify({"message": "AWS credentials not configured."}), 500
    
    except ClientError as e:
        current_app.logger.error(f"S3 Error: {e}")
        return jsonify({"message": f"Error accessing S3: {e}"}), 500
    

@api_routes.route('/api/stream/<path:video_key>', methods=['GET'])
@login_required
def stream_video(video_key):
    """
    Generates a presigned URL for streaming a video from S3.
    """
    s3 = get_s3_client()
    bucket_name = current_app.config.get('S3_BUCKET_NAME')

    try:
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': video_key},
            ExpiresIn=3600  # Link expires in 1 hour
        )
        return jsonify({"url": presigned_url}), 200
    
    except NoCredentialsError:
        current_app.logger.error("AWS credentials not found")
        return jsonify({"message": "AWS credentials not configured."}), 500
    
    except ClientError as e:
        current_app.logger.error(f"S3 Error: {e}")
        return jsonify({"message": f"Error generating stream URL: {e}"}), 500


# debugging: check if connection to database works
# ----------------------------------------------------------------------------
@api_routes.route('/api/health-check')
def health_check():
    """A simple endpoint to verify database connectivity and table existence."""
    try:
        conn = get_db()
        with conn.cursor() as cur:
            # Check 1: Basic connection
            cur.execute('SELECT 1')
            
            # Check 2: Verify that the 'users' table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'users'
                );
            """)
            table_exists = cur.fetchone()[0]

            if not table_exists:
                return jsonify({"status": "error", "message": "Database connection successful, but 'users' table not found."}), 500

        return jsonify({"status": "ok", "message": "Database connection and 'users' table check successful."}), 200
    
    except psycopg2.Error as e:
        return jsonify({"status": "error", "message": f"Database connection failed: {e}"}), 500
    
    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {e}"}), 500
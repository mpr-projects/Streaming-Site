import argparse
import boto3
import os
import sys
import threading
import tempfile
from botocore.exceptions import NoCredentialsError, ClientError


class ProgressPercentage(object):
    """A class to display a progress bar for Boto3 uploads."""
    def __init__(self, filename):
        self._filename = filename
        self._size = float(os.path.getsize(filename))
        self._seen_so_far = 0
        self._lock = threading.Lock()

    def __call__(self, bytes_amount):
        # To simplify, assuming this is hooked up to a single file upload.
        with self._lock:
            self._seen_so_far += bytes_amount
            percentage = (self._seen_so_far / self._size) * 100
            sys.stdout.write(
                f"\r-> Uploading {os.path.basename(self._filename)}: {self._seen_so_far / (1024*1024):.2f}MB / {self._size / (1024*1024):.2f}MB ({percentage:.2f}%)"
            )
            sys.stdout.flush()


def upload_to_s3(file_path, bucket_name, region_name, profile_name, object_name=None):
    """
    Upload a file to an S3 bucket.

    :param file_path: Path to the file to upload.
    :param bucket_name: Bucket to upload to.
    :param region_name: AWS region of the bucket.
    :param profile_name: The AWS credentials profile to use.
    :param object_name: S3 object name. If not specified, the file's basename is used.
    :return: True if file was uploaded, else False.
    """
    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = os.path.basename(file_path)

    session = boto3.session.Session(profile_name=profile_name)
    s3_client = session.client('s3', region_name=region_name)

    try:
        print(f"Starting upload of '{file_path}' to bucket '{bucket_name}' in region '{region_name}' as '{object_name}'...")
        progress = ProgressPercentage(file_path)
        s3_client.upload_file(
            file_path,
            bucket_name,
            object_name,
            ExtraArgs={'ACL': 'bucket-owner-full-control'},
            Callback=progress
        )
        sys.stdout.write("\nUpload Complete!\n")

    except FileNotFoundError:
        print(f"Error: The file was not found at '{file_path}'")
        return False
    
    except NoCredentialsError:
        print("Error: AWS credentials not found. Ensure they are configured in ~/.aws/credentials or as environment variables.")
        return False
    
    except ClientError as e:
        if e.response['Error']['Code'] == 'IllegalLocationConstraintException':
             print(f"\nError: The bucket '{bucket_name}' is not in the specified region '{region_name}'.")
             print("Please provide the correct region for the bucket.")
        else:
            print(f"\nAn S3 client error occurred: {e}")
        return False
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Upload a file to AWS S3. Configuration is sourced from command-line arguments, then environment variables.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("file_path", help="The full path to the file you want to upload.")
    parser.add_argument(
        "-b", "--bucket",
        default=os.environ.get('S3_BUCKET_NAME'),
        help="The S3 bucket name. Defaults to S3_BUCKET_NAME environment variable."
    )
    parser.add_argument(
        "-r", "--region",
        default=os.environ.get('AWS_REGION'),
        help="The AWS region of the bucket. Defaults to AWS_REGION environment variable."
    )
    parser.add_argument(
        "-p", "--profile",
        default="default",
        help="The AWS profile name to use. Defaults to 'default'."
    )

    parser.add_argument(
        "-l", "--label",
        help="A text label/title for the video. This will be saved in a corresponding .txt file."
    )
    parser.add_argument(
        "-t", "--thumbnail",
        help="Path to a thumbnail image file (e.g., .png, .jpg) for the video."
    )

    parser.add_argument(
        "-o", "--object-name",
        help="The S3 object name to use. If not specified, the file's basename is used."
    )

    args = parser.parse_args()

    if not args.bucket:
        print("Error: S3 bucket not specified. Provide it with --bucket or the S3_BUCKET_NAME environment variable.")
        sys.exit(1)
    if not args.region:
        print("Error: AWS region not specified. Provide it with --region or the AWS_REGION environment variable.")
        sys.exit(1)

    # determine the base name for all assets to ensure they are linked.
    if args.object_name:
        # If user provides an object name (e.g., "my-video.mp4"), use its base ("my-video").
        base_name, video_ext = os.path.splitext(args.object_name)
        if not video_ext: # If user just gave 'my-video', use original file extension.
            video_ext = os.path.splitext(args.file_path)[1]
        video_object_name = base_name + video_ext

    else:
        # Otherwise, use the base of the source file path.
        base_name, video_ext = os.path.splitext(os.path.basename(args.file_path))
        video_object_name = base_name + video_ext

    # 1. Upload the main video file first.
    print("\n--- Uploading Video File ---")
    success = upload_to_s3(args.file_path, args.bucket, args.region, args.profile, video_object_name)

    if not success:
        print("\nVideo upload failed. Aborting.")
        sys.exit(1)

    # 2. Handle and upload the label file if provided.
    if args.label:
        print("\n--- Uploading Label File ---")
        label_object_name = base_name + ".txt"

        # Use a temporary file to hold the label content for upload.
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix=".txt", encoding='utf-8') as temp_label_file:
            temp_label_file.write(args.label)
            temp_label_file_path = temp_label_file.name
            
        upload_to_s3(temp_label_file_path, args.bucket, args.region, args.profile, label_object_name)
        os.remove(temp_label_file_path) # Clean up the temporary file.

    # 3. Handle and upload the thumbnail file if provided.
    if args.thumbnail:
        print("\n--- Uploading Thumbnail File ---")
        if not os.path.exists(args.thumbnail):
            print(f"Error: Thumbnail file not found at '{args.thumbnail}'. Skipping thumbnail upload.")
        else:
            _, thumb_ext = os.path.splitext(args.thumbnail)
            thumbnail_object_name = base_name + thumb_ext.lower()
            upload_to_s3(args.thumbnail, args.bucket, args.region, args.profile, thumbnail_object_name)
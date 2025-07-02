import os
from flask import Flask, jsonify, request, redirect, url_for
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect, generate_csrf

from werkzeug.exceptions import HTTPException
from models import User
from file_routes import file_routes
from api_routes import api_routes
from db import get_db, init_app


# --- APP SETUP ---

# We set static_folder to None because we are defining our own routes to serve
# public and protected files with different access controls. This prevents
# Flask's default static file handler from interfering.
app = Flask(__name__, static_folder=None)

# using a secret key for session management and CSRF protection
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a-very-secret-key-that-you-should-change')

app.config['DATABASE_URL'] = os.environ.get('DATABASE_URL')
app.config['AWS_REGION'] = os.environ.get('AWS_REGION')
app.config['S3_BUCKET_NAME'] = 'streaming-site-video-data'  # hardcoded for now

# Initialize database management
init_app(app)

# --- FLASK-LOGIN SETUP ---
login_manager = LoginManager()
login_manager.init_app(app)

# this line specifies the function that returns the login page
login_manager.login_view = 'file_routes.serve_index'

@login_manager.user_loader
def load_user(user_id):
    conn = get_db()
    return User.get(conn, user_id)

# If an unauthenticated user tries to access a @login_required route,
# Flask-Login will normally redirect. For an API, return a 401 error.
@login_manager.unauthorized_handler
def unauthorized():
    # For an SPA, any unauthorized request for a protected resource (API or file)
    # that is likely initiated by a client-side script will return a 401 error.
    if request.path.startswith('/api/') or request.path.startswith('/protected/'):
        return jsonify({"message": "Authentication required."}), 401
    # For direct browser navigation to a protected page, redirect to the main app page.
    return redirect(url_for('file_routes.serve_index'))


# --- CSRF PROTECTION SETUP ---
csrf = CSRFProtect(app)

# After each request, we set a new CSRF token in a cookie.
# This is the "double-submit" cookie pattern.
@app.after_request
def set_csrf_cookie(response):
    response.set_cookie('csrf_token', generate_csrf())
    return response


# --- GLOBAL ERROR HANDLER ---
@app.errorhandler(Exception)
def handle_exception(e):
    """
    A global error handler to ensure that API routes always return JSON,
    even on unhandled exceptions.
    """
    # Pass through HTTP-specific errors (e.g., 404, 405)
    if isinstance(e, HTTPException):
        return e

    # For any other non-HTTP exception, log it and return a generic 500 error.
    app.logger.error(f"An unhandled exception occurred: {e}", exc_info=True)

    if request.path.startswith('/api/'):
        return jsonify({"message": "An internal server error occurred."}), 500
    
    # For non-API routes
    return "<h1>500 - Internal Server Error</h1><p>Something went wrong on our end.</p>", 500


# --- BLUEPRINT REGISTRATION ---
app.register_blueprint(file_routes)
app.register_blueprint(api_routes)


if __name__ == '__main__':
    # for development, run locally; on aws Gunicorn is used
    app.run(debug=True, port=5001)
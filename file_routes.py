from flask import Blueprint, send_from_directory
from flask_login import login_required


# Create a Blueprint. The first argument is the blueprint's name,
# the second is the import name, which is used to locate resources.
file_routes = Blueprint('file_routes', __name__)


@file_routes.route('/')
def serve_index():
    return send_from_directory('static/public', 'index.html')


@file_routes.route('/protected/<path:filename>')
@login_required
def serve_protected_file(filename):
    return send_from_directory('static/protected', filename)


@file_routes.route('/<path:path>')
def serve_public_file(path):
    return send_from_directory('static/public', path)
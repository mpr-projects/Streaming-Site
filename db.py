import psycopg2
from flask import current_app, g

def get_db():
    """
    Opens a new database connection if there is none yet for the
    current application context.
    """
    if 'db' not in g:
        g.db = psycopg2.connect(current_app.config['DATABASE_URL'])
    return g.db

def close_db(e=None):
    """
    Closes the database connection. This function is called automatically
    when the application context is torn down.
    """
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_app(app):
    """
    Register the close_db function with the Flask app. This ensures
    it's called after each request.
    """
    app.teardown_appcontext(close_db)
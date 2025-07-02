from flask_login import UserMixin


class User(UserMixin):
    def __init__(self, id, email, password_hash):
        self.id = id
        self.email = email
        self.password_hash = password_hash

    @staticmethod
    def get(conn, user_id):
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, password_hash FROM users WHERE id = %s", (user_id,))
            user_data = cur.fetchone()
        if user_data:
            return User(id=user_data[0], email=user_data[1], password_hash=user_data[2])
        return None

    @staticmethod
    def get_by_email(conn, email):
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, password_hash FROM users WHERE email = %s", (email,))
            user_data = cur.fetchone()
        if user_data:
            return User(id=user_data[0], email=user_data[1], password_hash=user_data[2])
        return None

    @staticmethod
    def create(conn, email, password_hash):
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id", (email, password_hash))
            user_id = cur.fetchone()[0]
        return User(id=user_id, email=email, password_hash=password_hash)

class DatabaseError(Exception):
    pass
DROP TABLE IF EXISTS user_profiles;
CREATE TABLE user_profiles(
    id SERIAL PRIMARY KEY,
    user_id INTEGER references users(id),
    age INTEGER,
    city VARCHAR(100),
    homepage VARCHAR(100),
    timestamp TIMESTAMP default current_TIMESTAMP);

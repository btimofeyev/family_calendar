const pool = require('../config/db');
const bcrypt = require('bcrypt');

const createUser = async ({ email, password, name, family_id }) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = {
      text: 'INSERT INTO users (email, password, name, family_id) VALUES ($1, $2, $3, $4) RETURNING *',
      values: [email, hashedPassword, name, family_id],
    };

    const res = await pool.query(query);
    return res.rows[0];
  } catch (err) {
    throw new Error('Error creating user: ' + err.message);
  }
};

const findUserByEmail = async (email) => {
  try {
    const query = {
      text: 'SELECT * FROM users WHERE email = $1',
      values: [email],
    };

    const res = await pool.query(query);
    return res.rows[0];
  } catch (err) {
    throw new Error('Error finding user by email: ' + err.message);
  }
};

const validPassword = async (inputPassword, storedPassword) => {
  try {
    return await bcrypt.compare(inputPassword, storedPassword);
  } catch (err) {
    throw new Error('Error validating password: ' + err.message);
  }
};

module.exports = {
  createUser,
  findUserByEmail,
  validPassword,
};

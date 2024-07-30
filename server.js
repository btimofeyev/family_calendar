const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const socialFeedRoutes = require('./src/routes/socialFeedRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Increase payload size limit (adjust the limit as needed)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files TEST PUSH
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', socialFeedRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
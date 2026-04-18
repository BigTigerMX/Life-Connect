const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lifeconnect');
    console.log('✅ MongoDB Conectado');
  } catch (error) {
    console.error('❌ Error MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;

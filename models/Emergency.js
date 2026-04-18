const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => Math.floor(100000 + Math.random() * 900000).toString()
  },
  type: {
    type: String,
    enum: ['heart', 'bleeding', 'breathing', 'fall', 'poison', 'other'],
    required: true
  },
  location: {
    lat: Number,
    lng: Number,
    accuracy: Number
  },
  patientData: {
    name: String,
    age: Number,
    bloodType: String,
    allergies: String,
    conditions: [String],
    medications: String,
    contactName: String,
    contactPhone: String,
    description: String
  },
  forOther: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  outcome: {
    type: String,
    enum: ['resolved', 'hospital', 'false', 'other', null],
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Emergency', emergencySchema);

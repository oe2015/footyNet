const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const User = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  });

const Team = new mongoose.Schema({
    name: String,
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
  });
  
const Pitch = new mongoose.Schema({
    location: String,
    availability: [Date],
    price: Number,
});

const Match = new mongoose.Schema({
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true }],
    pitch: { type: mongoose.Schema.Types.ObjectId, ref: 'Pitch', required: true },
    date: Date,
    time: String,
});

const League = new mongoose.Schema({
    name: String,
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    schedule: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    standings: [{
      team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      points: Number,
    }],
});
  
  
  
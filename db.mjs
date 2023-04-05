import mongoose from 'mongoose';
const Schema = mongoose.Schema;


console.log('Waiting for connection to database...')
try {
  // await mongoose.connect("mongodb://omarelherraoui:Pq18ZbyEnfPBefpfiYO9qlI3n0leXFmAfJo5HX71Jgqvpz5FzKqBQMnmV64TPXjLhxwZSNcoBPdZACDbEGm7Hw==@omarelherraoui.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@omarelherraoui@", {useNewUrlParser: true});
  await mongoose.connect('mongodb://localhost/footyNet', {useNewUrlParser: true});
  console.log('Successfully connected to database.')
} catch (err) {
  console.log('ERROR: ', err);
}

const User = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    // team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
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

mongoose.model('User', User);
mongoose.model('Team', Team);
mongoose.model('Pitch', Pitch);
mongoose.model('Match', Match);
mongoose.model('League', League);

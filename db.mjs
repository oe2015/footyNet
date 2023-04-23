import mongoose from 'mongoose';
const Schema = mongoose.Schema;


console.log('Waiting for connection to database...')
try {
  // await mongoose.connect("mongodb://omarelherraoui:Pq18ZbyEnfPBefpfiYO9qlI3n0leXFmAfJo5HX71Jgqvpz5FzKqBQMnmV64TPXjLhxwZSNcoBPdZACDbEGm7Hw==@omarelherraoui.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@omarelherraoui@", {useNewUrlParser: true});
  await mongoose.connect("mongodb://omarelherraoui:Pq18ZbyEnfPBefpfiYO9qlI3n0leXFmAfJo5HX71Jgqvpz5FzKqBQMnmV64TPXjLhxwZSNcoBPdZACDbEGm7Hw==@omarelherraoui.mongo.cosmos.azure.com:10255/footyNet?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@omarelherraoui@", {useNewUrlParser: true, useUnifiedTopology: true});
  // await mongoose.connect('mongodb://localhost/footyNet', {useNewUrlParser: true});
  // await mongoose.connect('mongodb://216.165.95.181/footyNet', {useNewUrlParser: true});
  console.log('Successfully connected to database.')
} catch (err) {
  console.log('ERROR: ', err);
}

const User = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', sparse: true},
  });

const Team = new mongoose.Schema({
    name: String,
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    leagues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'League' }]
  });
  
const Pitch = new mongoose.Schema({
    name: String,
    address: String,
});

const Match = new mongoose.Schema({
    team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    pitch: { type: mongoose.Schema.Types.ObjectId, ref: 'Pitch' },
    date: Date,
    team1Goals: Number,
    team2Goals: Number
});

const League = new mongoose.Schema({
    name: String,
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    schedule: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    standings: [{
      team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      points: Number,
      GF: Number,
      GA: Number,
      GD: Number,
      MP: Number,
      W: Number,
      D: Number,
      L: Number
    }],
});

mongoose.model('User', User);
mongoose.model('Team', Team);
mongoose.model('Pitch', Pitch);
mongoose.model('Match', Match);
mongoose.model('League', League);

//hellooooooxxx

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import sanitize from 'mongo-sanitize';
import './db.mjs';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import requestIp from 'request-ip';


import {startAuthenticatedSession, endAuthenticatedSession} from './auth.mjs';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'hbs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: false }));

app.use(requestIp.mw());


app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
}));

const User = mongoose.model('User');
const Team = mongoose.model('Team');
const Pitch = mongoose.model('Pitch');
const Match = mongoose.model('Match');
const League = mongoose.model('League');


const authRequired = (req, res, next) => {
  if(!req.session.user) 
  {
    req.session.redirectPath = req.path;
    res.redirect('/login'); 
  } else {
    next();
  }
};

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get('/', authRequired, async (req, res) => 
{
  res.render('home', {user: req.session.user});
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const username = sanitize(req.body.username);
  const password = sanitize(req.body.password);
  const email = sanitize(req.body.email);

  try {
    const existingUser = await User.findOne({username: username}).exec();
    const existingUser1 = await User.findOne({email: email}).exec();
    if (existingUser1) 
    {
      res.render('signup', {message: 'email already exists'});
      return;
    }
    if (existingUser) 
    {
      res.render('signup', {message: 'Username already exists'});
      return;
    }

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: username,
      email: email,
      password: hash
    });
    await newUser.save();

    await startAuthenticatedSession(req, newUser);

    res.redirect('/');
  } catch (err) {
    if(err instanceof mongoose.Error.ValidationError) {
      res.render('signup', {message: err.message});
    } else {
      throw err;
    }
  }
});
        
app.get('/logout', async (req, res) => {
  await endAuthenticatedSession(req);
  res.redirect('login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
  const username = sanitize(req.body.username);
  const password = sanitize(req.body.password);

  try {
    const user = await User.findOne({username: username}).exec();
    if (!user) {
      res.render('login', {message: 'Invalid login or password'});
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.render('login', {message: 'Invalid login or password'});
      return;
    }

    await startAuthenticatedSession(req, user);

    const redirectPath = req.session.redirectPath || '/';
    delete req.session.redirectPath;
    res.redirect(redirectPath);
  } catch (err) {
    if(err instanceof mongoose.Error.ValidationError) {
      res.render('login', {message: err.message});
    } else {
      throw err;
    }
  }
});

// GET /teams
app.get('/teams', authRequired, async (req, res) => {
    res.render('teams');
});
  
  // GET /teams/new
app.get('/teams/new', authRequired, (req, res) => {
    res.render('createTeam');
});
  
  // POST /teams
app.post('/teams/new', authRequired, async (req, res) => {
    try {

      const user = await User.findById(req.session.user._id).populate('team');
      if (!user) {
        res.status(404).send('User not found');
        return;
      }
  
      // If the user is already associated with a team, display an error message
      if (user.team) 
      {
        const teams = await Team.find({}).populate('captain').populate('players');
        const errorMessage = 'User is already associated with a team';
        res.render('teamsList', { teams, errorMessage });
        return;
      }
    
      const name = sanitize(req.body.name);

      const players = [user._id]; 
  
      const team = new Team({
        name,
        captain: user._id,
        players: players,
      });
  
      await team.save();

      user.team = team;
      await user.save();

      req.session.user = await User.findById(user._id).populate('team');


      res.redirect(`/team/${team._id}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
});
  
app.get('/teams/join', authRequired, async (req, res) => {
    try {
      const teams = await Team.find({}).populate('captain').populate('players');
      res.render('teamsList', { teams });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  });
  

app.post('/teams/join', authRequired, async (req, res) => {
  try {
    const team = await Team.findById(req.body.teamId);
    if (!team) {
      res.status(404).send('Team not found');
      return;
    }

    const user = await User.findById(req.session.user._id).populate('team');
    if (!user) {
      res.status(404).send('User not found');
      return;
    }

    // If the user is already associated with a team, display an error message
    if (user.team) {
      const teams = await Team.find({}).populate('captain').populate('players');
      const errorMessage = 'User is already associated with a team';
      res.render('teamsList', { teams, errorMessage });
      return;
    }

    team.players.push(user);
    await team.save();

    user.team = team;
    await user.save();

    req.session.user = await User.findById(user._id).populate('team');


    res.redirect(`/team/${team._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/team/:id', authRequired, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('captain')
      .populate('players')
      .populate({
        path: 'matches',
        populate: [
          { path: 'team1', select: 'name' },
          { path: 'team2', select: 'name' },
          { path: 'pitch', select: 'name' },
        ],
      }).populate('leagues');

    // Filter matches based on the current date
    const currentDate = new Date();
    const updatedMatches = team.matches.filter(match => match.date > currentDate);

    // Remove outdated matches from the database
    const outdatedMatches = team.matches.filter(match => match.date <= currentDate);
    for (const match of outdatedMatches) {
      await Match.findByIdAndDelete(match._id);
    }

    // Update the team's matches
    team.matches = updatedMatches;
    await team.save();

    // Prepare matches data for rendering
    const matchesData = updatedMatches.map((match) => {
      const opponent = match.team1._id.equals(team._id) ? match.team2 : match.team1;
      return {
        ...match._doc,
        opponent,
      };
    });

    res.render('teamid', { team: team, matches: matchesData });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/match', authRequired, async (req, res) => {
  try {
    const userTeam = await Team.findById(req.session.user.team).exec();
    const hasTeam = !!userTeam;

    if (hasTeam) {
      const teams = await Team.find({ _id: { $ne: userTeam._id } });
      res.render('match', { teams, hasTeam });
    } else {
      res.render('match', { hasTeam });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// POST /match
app.post('/match', authRequired, async (req, res) => {
  try {
    const team1 = await Team.findById(req.session.user.team);
    const team2 = await Team.findById(req.body.teamId);
    const date = new Date(req.body.date);

    const match = new Match({
      team1: team1._id,
      team2: team2._id,
      date: date,
    });

    await match.save();

    team1.matches.push(match);
    await team1.save();

    team2.matches.push(match);
    await team2.save();

    // Filter matches based on the current date
    const currentDate = new Date();
    const outdatedMatches = await Match.find({
      $or: [{ team1: team1._id }, { team2: team1._id }],
      date: { $lte: currentDate },
    });

    // Remove outdated matches and associated pitches
    for (const outdatedMatch of outdatedMatches) {
      await Pitch.findByIdAndDelete(outdatedMatch.pitch);
      await Match.findByIdAndDelete(outdatedMatch._id);
    }

    res.redirect(`/match/${match._id}/pitches`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


import { Client } from '@googlemaps/google-maps-services-js';
import axios from 'axios';

// const googleMapsClient = new Client({});

const apiKey = "AIzaSyC2DWdWaBKbRsIWI7btntY2LdmL9yJK-C0";
const geolocationUrl = `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`;

const googleMapsClient = new Client({ apiKey: apiKey }); // Add the apiKey here

async function reverseGeocode(lat, lng) {
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    return data.results[0].formatted_address;
  } else {
    return 'Address not found';
  }
}

async function getCurrentLocation(ip) {
  const response = await axios.get(`http://ip-api.com/json/${ip}`);

  if (response.data.status === 'success') {
    return {
      lat: response.data.lat,
      lng: response.data.lon,
    };
  } else {
    throw new Error('Failed to get geolocation');
  }
}


async function searchNearbyPitches(lat, lng, distance) 
{
  const response = await googleMapsClient.placesNearby({
    params: {
      location: `${lat},${lng}`,
      radius: distance,
      keyword: 'football pitch',
      key: apiKey,
    },
  });
  
  const pitches = response.data.results
    .filter(result => result.business_status === 'OPERATIONAL')
    .map(result => ({
      name: result.name,
      location: result.geometry.location,
      availability: true, 
    }))
    .filter(pitch => pitch.availability); 
  
  return pitches;
}

app.get('/match/:id/pitches', authRequired, async (req, res) => {
  try {
    const matchId = req.params.id;

    // Get user's current location using Google Maps API
    // const { lat, lng } = await getCurrentLocation(req.ip);
    const clientIpWithPort = req.headers['x-forwarded-for'];

    // Remove the port number from the IP address
    const clientIp = clientIpWithPort.split(':')[0];

    const { lat, lng } = await getCurrentLocation(clientIp);

    // Search for nearby pitches using Google Maps API
    const nearbyPitches = await searchNearbyPitches(lat, lng, 5000);

    await Promise.all(nearbyPitches.map(async (pitch) => {
      pitch.address = await reverseGeocode(pitch.location.lat, pitch.location.lng);
    }));
    
    res.render('pitchList', { pitches: nearbyPitches, matchId});
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail', // Replace this with your email service
  auth: {
    user: 'footynet1234@gmail.com', // Replace this with your email
    pass: 'bfdzxoazktaeqngq',
  },
});


async function sendBookingEmail(userEmail, match, pitch) {
  const opponent = await Team.findById(match.team2);

  const mailOptions = {
    from: 'footynet1234@gmail.com', // Replace this with your email
    to: userEmail,
    subject: 'Match Booking Confirmation',
    text: `Dear user,

    Your match booking has been confirmed!

    Match details:
    - Date and time: ${match.date}
    - Opponent: ${opponent.name}
    - Pitch name: ${pitch.name}
    - Pitch address: ${pitch.address}

    Good luck and have fun!

    Best regards,
    FootyNet Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}


app.post('/match/:id/pitch', authRequired, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    const teams = await Team.find({}).populate('captain').populate('players');

    const pitch = new Pitch({
      name: req.body.name,
      address: req.body.address,
    })

    await pitch.save();

    match.pitch = pitch._id;
    await match.save();

    const user = await User.findById(req.session.user._id).populate('team');
    const teamId = user.team._id;

    // Send booking confirmation email
    await sendBookingEmail(user.email, match, pitch);

    res.redirect(`/team/${teamId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/match/:id/updateMaxRange', authRequired, async (req, res) => {
  try {
    const maxRange = req.body.maxRange;

    const clientIpWithPort = req.headers['x-forwarded-for'];

    // Remove the port number from the IP address
    const clientIp = clientIpWithPort.split(':')[0];

    const { lat, lng } = await getCurrentLocation(clientIp);

    // Search for nearby pitches using Google Maps API
    const nearbyPitches = await searchNearbyPitches(lat, lng, maxRange);

    await Promise.all(nearbyPitches.map(async (pitch) => {
      pitch.address = await reverseGeocode(pitch.location.lat, pitch.location.lng);
    }));

    res.render('pitchList', { matchId: req.params.id, pitches: nearbyPitches });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/profile', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('team');
    res.render('profile', { user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/leagues', authRequired, (req, res) => {
  res.render('leagues');
});

app.get('/leagues/new', authRequired, (req, res) => {
  res.render('leaguesNew');
});

app.post('/leagues/new', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('team');
    const team = user.team;

    // Create new league
    const newLeague = new League({
      name: req.body.leagueName,
      teams: [team._id],
      standings: [{
        team: team._id,
        points: 0,
        GF: 0,
        GA: 0,
        GD: 0,
        MP: 0,
        W: 0,
        D: 0,
        L: 0
      }]
    });

    await newLeague.save();

    // Update the team schema with the new league
    team.leagues.push(newLeague._id);
    await team.save();

    // Redirect to the team page
    res.redirect(`/league/${newLeague._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/leagues/join', authRequired, async (req, res) => {
  try {
    const leagues = await League.find();
    res.render('leaguesJoin', { leagues });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/leagues/join/:leagueId', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('team');
    const team = user.team;
    const league = await League.findById(req.params.leagueId);

    // Check if the team has already joined the league
    const hasJoined = league.teams.some(teamId => teamId.equals(team._id));
    if (hasJoined) {
      // Show an error message if the team has already joined
      const leagues = await League.find({});
      const errorMessage = 'Already joined this league';
      return res.render('leaguesJoin', { leagues, errorMessage });
    }

    // Add team to the league
    league.teams.push(team._id);

    // Initialize the team's standings in the league
    league.standings.push({
      team: team._id,
      points: 0,
      GF: 0,
      GA: 0,
      GD: 0,
      MP: 0,
      W: 0,
      D: 0,
      L: 0
    });

    await league.save();

    // Add league to the team
    team.leagues.push(league._id);
    await team.save();

    // Redirect to the league page
    res.redirect(`/league/${league._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


import hbs from 'hbs';

hbs.registerHelper('addOne', function (value) {
  return parseInt(value, 10) + 1;
});

app.get('/league/:leagueId', async (req, res) => {
  try {
    const league = await League.findById(req.params.leagueId)
      .populate('teams')
      .populate('schedule')
      .populate({
        path: 'standings.team',
        model: 'Team'
      });

    // Sort the standings
    league.standings.sort((a, b) => {
      if (a.points === b.points) {
        return b.GD - a.GD;
      } else {
        return b.points - a.points;
      }
    });

    res.render('leagueID', { league: league });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/leagues/update', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('team');
    const team = user.team;
    const matches = await Match.find({ $or: [{ team1: team._id }, { team2: team._id }] })
      .populate('team1')
      .populate('team2')
      .populate('pitch');

    res.render('leagueUpdate', { team, matches });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

async function updateStandings(league, userTeam, opponent, userTeamGoals, opponentGoals) {
  // Find standings for the user's team and the opponent
  const userTeamStanding = league.standings.find(standing => standing.team.equals(userTeam._id));
  const opponentStanding = league.standings.find(standing => standing.team.equals(opponent._id));

  // Update GF, GA, and GD for both teams
  userTeamStanding.GF += userTeamGoals;
  userTeamStanding.GA += opponentGoals;
  userTeamStanding.GD = userTeamStanding.GF - userTeamStanding.GA;

  opponentStanding.GF += opponentGoals;
  opponentStanding.GA += userTeamGoals;
  opponentStanding.GD = opponentStanding.GF - opponentStanding.GA;

  // Update MP, W, D, L, and points based on the match result
  userTeamStanding.MP += 1;
  opponentStanding.MP += 1;

  if (userTeamGoals > opponentGoals) {
    userTeamStanding.W += 1;
    userTeamStanding.points += 3;
    opponentStanding.L += 1;
  } else if (userTeamGoals < opponentGoals) {
    userTeamStanding.L += 1;
    opponentStanding.W += 1;
    opponentStanding.points += 3;
  } else {
    userTeamStanding.D += 1;
    userTeamStanding.points += 1;
    opponentStanding.D += 1;
    opponentStanding.points += 1;
  }

  // Save the updated league standings
  await league.save();
}

app.post('/leagues/update', authRequired, async (req, res) => {
  try {
    const matchId = req.body.matchId;
    const userTeamGoals = parseInt(req.body.userTeamGoals);
    const opponentGoals = parseInt(req.body.opponentGoals);

    const match = await Match.findById(matchId).populate('team1').populate('team2');
    const userTeam = match.team1._id.equals(req.session.user.team) ? match.team1 : match.team2;
    const opponent = match.team1._id.equals(req.session.user.team) ? match.team2 : match.team1;

    // Find the league containing both teams
    const league = await League.findOne({
      teams: { $all: [userTeam._id, opponent._id] }
    });

    // Update the league standings based on the results
    await updateStandings(league, userTeam, opponent, userTeamGoals, opponentGoals);

    // Remove the match and pitch from the database
    await Pitch.findByIdAndDelete(match.pitch);
    await Match.findByIdAndDelete(matchId);

    res.redirect(`/league/${league._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(process.env.PORT || 3000);


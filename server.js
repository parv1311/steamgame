const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); 

const app = express();
const port = process.env.PORT || 3001; 

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'bearrun1311',
  database: 'steamgame',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to the database');
  }
});

// Fetch all genres
app.get('/api/genres', (req, res) => {
  const genres = [
    { GenreId: '301', GenreName: 'First-Person Shooter' },
    { GenreId: '302', GenreName: 'Racing' },
    { GenreId: '303', GenreName: 'Open World' },
  ];

  res.json(genres);
});

// Fetch all games with their genres
app.get('/api/games', (req, res) => {
  db.query('SELECT Game.*, Genre.GenreName FROM Game JOIN Genre ON Game.GenreId = Genre.GenreId', (err, results) => {
    if (err) {
      console.error('Error fetching games:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(results);
    }
  });
});

// Associate a game with a publisher and simulate a trigger to associate with a developer
app.post('/api/publishergame', (req, res) => {
  console.log('Received request to /api/publishergame');
  const { PublisherId, GameId } = req.body;

  db.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    // Insert into publishergame table
    db.query('INSERT INTO publishergame (PublisherId, GameId) VALUES (?, ?)', [PublisherId, GameId], (err, results) => {
      if (err) {
        console.error('Error updating publishergame table:', err);
        db.rollback(() => {
          res.status(500).json({ error: 'Internal Server Error' });
        });
      } else {
        db.query('SELECT DeveloperId FROM Game WHERE GameId = ?', [GameId], (err, developerResults) => {
          if (err) {
            console.error('Error fetching DeveloperId:', err);
            db.rollback(() => {
              res.status(500).json({ error: 'Internal Server Error' });
            });
          } else {
            const DeveloperId = developerResults[0].DeveloperId;
            db.query('INSERT INTO developergame (DeveloperId, GameId) VALUES (?, ?)', [DeveloperId, GameId], (err, results) => {
              if (err) {
                console.error('Error updating developergame table:', err);
                db.rollback(() => {
                  res.status(500).json({ error: 'Internal Server Error' });
                });
              } else {
                // Commit the transaction
                db.commit((err) => {
                  if (err) {
                    console.error('Error committing transaction:', err);
                    db.rollback(() => {
                      res.status(500).json({ error: 'Internal Server Error' });
                    });
                  } else {
                    res.json({ success: true });
                  }
                });
              }
            });
          }
        });
      }
    });
  });
});
  

// Add a new game
app.post('/api/games', (req, res) => {
  const { GameName, ReleaseDate, Size, PublisherId, DeveloperId, GenreId, Rating } = req.body;

  db.query(
    'INSERT INTO Game (GameName, ReleaseDate, Size, PublisherId, DeveloperId, GenreId, Rating) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [GameName, ReleaseDate, Size, PublisherId, DeveloperId, GenreId, Rating],
    (err, results) => {
      if (err) {
        console.error('Error adding a new game:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        res.json({ success: true });
      }
    }
  );
});

// Associate a game with a developer
app.post('/api/developergame', (req, res) => {
  console.log('Received request to /api/developergame');
  const { DeveloperId, GameId } = req.body;

  db.query('INSERT INTO developergame (DeveloperId, GameId) VALUES (?, ?)', [DeveloperId, GameId], (err, results) => {
    if (err) {
      console.error('Error updating developergame table:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json({ success: true });
    }
  });
});

// Associate a game with a publisher
app.post('/api/publishergame', (req, res) => {
  console.log('Received request to /api/publishergame');
  const { PublisherId, GameId } = req.body;

  db.query('INSERT INTO publishergame (PublisherId, GameId) VALUES (?, ?)', [PublisherId, GameId], (err, results) => {
    if (err) {
      console.error('Error updating publishergame table:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json({ success: true });
    }
  });
});

// User sign-in
app.post('/api/signin', (req, res) => {
  const { UserId, Password, UserType } = req.body;

  db.query(
    'SELECT * FROM login WHERE UserId = ? AND Password = ? AND UserType = ?',
    [UserId, Password, UserType],
    (err, results) => {
      if (err) {
        console.error('Error during sign-in:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        if (results.length > 0) {
          res.json({ success: true });
        } else {
          res.json({ success: false, error: 'Invalid credentials' });
        }
      }
    }
  );
});

// Update a game
app.put('/api/games/:GameId', (req, res) => {
  const gameId = req.params.GameId;

  try {
    db.query('UPDATE Game SET Size = ?, GenreId = ? WHERE GameId = ?', [req.body.Size, req.body.GenreId, gameId], (err, results) => {
      if (err) {
        console.error('Error updating the game:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        res.json({ success: true });
      }
    });
  } catch (error) {
    if (error.code === 'ER_SIGNAL_EXCEPTION') {
      res.status(403).json({ error: error.message });
    } else {
      console.error('Error handling trigger exception:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

// Delete a game
app.delete('/api/games/:GameId', (req, res) => {
  const gameId = req.params.GameId;

  // Check if GameId exists
  db.query('SELECT * FROM Game WHERE GameId = ?', [gameId], (err, results) => {
    if (err) {
      console.error('Error checking GameId:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else if (results.length === 0) {
      // If no results, log and return a response
      console.log(`GameId ${gameId} does not exist`);
      res.status(404).json({ error: 'GameId does not exist' });
    } else {
      // Proceed with deletion if GameId exists
      db.query('DELETE FROM Game WHERE GameId = ?', [gameId], (err, deleteResults) => {
        if (err) {
          console.error('Error deleting the game:', err);
          res.status(500).json({ error: 'Internal Server Error' });
        } else {
          console.log(`GameId ${gameId} deleted successfully`);
          res.json({ success: true });
        }
      });
    }
  });
});

// Add this new endpoint
app.get('/api/developergames/:developerId', (req, res) => {
  const developerId = req.params.developerId;
  const queries = [
    // Query for games details
    `SELECT g.GameId, g.GameName, g.GameImage, g.Size, g.ReleaseDate, g.Rating, gr.GenreName 
     FROM Game g
     JOIN developergame dg ON g.GameId = dg.GameId
     LEFT JOIN Genre gr ON g.GenreId = gr.GenreId
     WHERE dg.DeveloperId = ?`,
    
    // Query for count of games
    `SELECT COUNT(*) as gameCount 
     FROM developergame 
     WHERE DeveloperId = ?`
  ];
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queries[0], [developerId], (err, games) => {
        if (err) reject(err);
        else resolve(games);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries[1], [developerId], (err, count) => {
        if (err) reject(err);
        else resolve(count[0]);
      });
    })
  ])
    .then(([games, count]) => {
      res.json({
        games: games,
        totalGames: count.gameCount
      });
    })
    .catch(err => {
      console.error('Error fetching developer games:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// Add this new endpoint for discount games
app.get('/api/discountgames', (req, res) => {
  const queries = [
    // Query for discounted games details
    `SELECT g.GameId, g.GameName, g.Size, g.ReleaseDate, g.Rating, gr.GenreName,
            d.DiscountPercentage, d.StartDate, d.EndDate 
     FROM Game g
     JOIN Discount d ON g.GameId = d.GameId
     LEFT JOIN Genre gr ON g.GenreId = gr.GenreId
     WHERE d.EndDate >= CURDATE()`,
    
    // Query for count of discounted games
    `SELECT COUNT(*) as discountCount 
     FROM Discount 
     WHERE EndDate >= CURDATE()`
  ];
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queries[0], (err, games) => {
        if (err) reject(err);
        else resolve(games);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queries[1], (err, count) => {
        if (err) reject(err);
        else resolve(count[0]);
      });
    })
  ])
    .then(([games, count]) => {
      res.json({
        games: games,
        totalDiscounts: count.discountCount
      });
    })
    .catch(err => {
      console.error('Error fetching discount games:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// Add this endpoint to get the next available ID
app.get('/api/nextId/:userType', (req, res) => {
  const userType = req.params.userType;
  
  const query = 'SELECT MAX(UserId) as maxId FROM login WHERE UserType = ?';
  
  db.query(query, [userType], (err, results) => {
    if (err) {
      console.error('Error getting next ID:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    let nextId;
    const maxId = results[0].maxId;
    
    if (!maxId) {
      // If no existing users of this type, start with base number
      switch(userType) {
        case 'User':
          nextId = 101;
          break;
        case 'Developer':
          nextId = 201;
          break;
        case 'Publisher':
          nextId = 301;
          break;
        default:
          nextId = 101;
      }
    } else {
      nextId = maxId + 1;
    }

    res.json({ nextId });
  });
});

// Update the register endpoint
app.post('/api/register', (req, res) => {
  const { userId, userName, password, userType } = req.body;

  // Start a transaction
  db.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Insert into login table
    const query = 'INSERT INTO login (UserId, UserName, Password, UserType) VALUES (?, ?, ?, ?)';
    
    db.query(query, [userId, userName, password, userType], (err, results) => {
      if (err) {
        db.rollback(() => {
          console.error('Error during registration:', err);
          res.status(400).json({ 
            error: err.code === 'ER_DUP_ENTRY' 
              ? 'User ID or Username already exists' 
              : 'Registration failed' 
          });
        });
        return;
      }

      // If successful, commit the transaction
      db.commit((err) => {
        if (err) {
          db.rollback(() => {
            console.error('Error committing transaction:', err);
            res.status(500).json({ error: 'Registration failed' });
          });
          return;
        }
        res.json({ 
          success: true,
          message: `Registration successful! Your User ID is: ${userId}`
        });
      });
    });
  });
});

// Serve the main 'index.html' file for all routes
app.use(express.static(path.join(__dirname, 'build')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

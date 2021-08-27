const express = require('express');

const app = express();

const port = 8080;

app.use(express.static('./'));

// Our first route
app.get('/', (req, res) => {
  res.sendFile('./index.html');
});

// Listen to port 5000
app.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});

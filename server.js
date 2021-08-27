const express = require('express');

const port = 8080;
const app = express();

app.use(express.static('./'));

app.get('/', (req, res) => {
  res.sendFile('./index.html');
});

// Listen to port 5000
app.listen(port, () => {
  console.log(`Server listening on port ${port}!`);
});

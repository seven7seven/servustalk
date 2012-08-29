var requestHandlers = require('./requestHandlers');

function addRoutes(app) {
    app.get('/login', requestHandlers.login);
    app.get('/', requestHandlers.index);
    app.get('/history', requestHandlers.history);
    app.get('/memegeist', requestHandlers.memegeist);
    app.get('/beta', requestHandlers.beta);
    app.get('/whitelist', requestHandlers.whitelist);
    app.get('/accept/:userid', requestHandlers.acceptUser);
    app.get('/ban/:userid', requestHandlers.banUser);
    app.get('/access', requestHandlers.access);
    app.get('/pay', requestHandlers.pay);
    app.post('/vote', requestHandlers.vote);
    app.post('/getMessages/:timestamp', requestHandlers.getMessages);
    app.get('/getMessages/:timestamp', requestHandlers.getMessages);
    app.post('/getMemes/:timestamp', requestHandlers.getMemes);
    app.get('/getMemes/:timestamp', requestHandlers.getMemes);
    app.get('/r/:room/', requestHandlers.room);
}

function setRealtimeEngine(engine) {
  requestHandlers.setRealtimeEngine(engine);
}

exports.addRoutes = addRoutes;
exports.setRealtimeEngine = setRealtimeEngine

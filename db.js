const { MongoClient } = require("mongodb");
let dbconnection;

module.exports = {
    connectToDb: (cb) => {
        MongoClient.connect('mongodb://127.0.0.1:27017/Project')
            .then((client) => {
                console.log("Connected");
                dbconnection = client.db();
                cb(null); // Call the callback with no error
            })
            .catch(err => {
                console.log(err);
                cb(err); // Call the callback with an error
            });
    },
    getDb: () => dbconnection
};

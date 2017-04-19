'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

const token = "EAAJUVx9UyPwBABMFMIQuPg0ZAOhVzd3gY7DZCarR8IfpDidteitbZCUWHseNTsMkjOfeZCzOZBBmbTfpZC0oZAOJZCgA5HhUHcxOTZBAST4tgHJDPPKywlg82rcmS4r8UuMVjX9SNSVGrWhUufeCGZAYs2ZB5mgbGzJZAXUGS40H5hZArGgZDZD";
var questions = [];
var users = [];

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    var current_user;
    var current_answerer;
    var text;
    var found = false;
    for (let i = 0; i < messaging_events.length; i++) {
	    let event = req.body.entry[0].messaging[i]
	    let sender = event.sender.id
	    if(event.message && event.message.text) {
	    	for(current_user = 0; current_user < users.length; current_user++) {
			    if(users[current_user].person == sender) {
			    	found = true;
			    	break;
			    }
		   	}
		   	sleep(3000);
	    	text = event.message.text;
	    	text = text.toLowerCase();
	    	//sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
	    	if(found && text == "ask"){
	    		sendTextMessage(sender, "Please ask your question.");
	    		users[current_user].asking = true;
	    	} else if(found && text == "answer") {
	    		if(!questions[0]) {
	    			sendTextMessage(sender, "No question right now. Sorry!");
	    		} else {
	    			sendTextMessage(sender, "Please answer the following question:");
	    			var question = questions[0].question;
	    			users[current_user].answering = true;
	    			questions[0].answerer = sender;
	    			sendTextMessage(sender, question);
	    		}
	    	} else if(found && users[current_user].answering == true) {
	    		for(current_answerer = 0; current_answerer < users.length; current_answerer++) {
				    if(questions[current_answerer].answerer == sender) {
				    	break;
				    }
			   	}
	    		sleep(3000);
	    		sendTextMessage(questions[current_answerer].asker, "You asked: " + questions[current_answerer].question);
	    		sendTextMessage(questions[current_answerer].asker, "The answer is: " + event.message.text);
	    		sendTextMessage(sender, "I just sent your answer to the asker. Thanks!");
	    		questions.shift();
	    	}  else if(found && users[current_user].asking == true) {
	    		questions.push({question: event.message.text, asker: sender, answerer: null});
	    		sendTextMessage(sender, "I will get back to you shortly");
	    	} else if(text != "ask" && text != "answer") {
		    		sendTextMessage(sender, "Do you want to ask or answer a question?");
		    		users.push({person: sender, answerer: null, prompted: true, asking: false, answering: false});
		    } else {
		    	sendTextMessage(sender, "Got to end");
		    }
	    }
    }
    found = false;
    res.sendStatus(200)
})

function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
	    url: 'https://graph.facebook.com/v2.9/me/messages',
	    qs: {access_token:token},
	    method: 'POST',
		json: {
		    recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
		    console.log('Error sending messages: ', error)
		} else if (response.body.error) {
		    console.log('Error: ', response.body.error)
	    }
    })
}

// Hacky, use callbacks in the morning
function sleep(miliseconds) {
   var currentTime = new Date().getTime();

   while (currentTime + miliseconds >= new Date().getTime()) {
   }
}


'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const token = process.env.token;
var http = require("http");
var total_usage = 0;
var total_sent_received = 0; 
var total_users = 169; // This is the number of users from my last version
var total_questions_asked = 0;
var total_questions_answered = 0;
 
// NOTE ABOUT THE FOLLOWING FUNCTION:
// - I am using a free heroku app, which 'sleeps' every hour if it is not pinged
// - When someone pings it after this hour, it starts up again with a different IP address
// - Some IP addresses are blacklisted from FB, which causes my app to crash
// - By pinging it every 30 minutes, it will never sleep and the IP address will never
//   change to a blacklisted one
setInterval(function() {
    http.get("http://peaceful-caverns-10612.herokuapp.com");
}, 900000); // 15 minutes

var questions = [];
var users = [];


var initialQuestions = ["How are you doing today?", "What makes you an interesting person?", "What is your current goal?", "What is your favorite type of cookie?", "What is your favorite TV show?", "Funniest thing that happened to you today?", "Where are you?", "What happens to us when we die?", "How old are you?", "Pancakes or waffles?", "What time is it for you?", "What should I eat for dinner?", "What is your middle name?", "Favorite band or musician?", "What is your favorite color?", "Funniest thing that happened to you this week?", "Best childhood memory?", "Would you rather be gossiped about or never talked about at all?", "Favorite school?", "Would you rather end hunger or hatred?", "Do you believe in parallel universes?", "Who is your favorite Disney character?", "Do you have a secret admirer?", "What is the craziest thing you did as a kid?", "What is your best memory from college?", "If there was a draft, would you dodge it?", "What is your favorite track and field event?", "What would make this chatbot better?", "Do you believe in aliens?", "What is the most attractive quality in a person?", "What's the grossest thing you've ever had to eat?", "Do you believe in luck?", "Who's the best rapper right now?", "What makes you happy?", "What's your biggest pet peeve?", "Who do you have a crush on?", "Would you recommend this bot to a friend? Why or why not?", "What could this bot do to improve?", "What sport would be the funniest to add a mandatory amount of alcohol to?", "What is today's date?", "What is 10 + 81?", "What is the funniest question you've been asked on Give or Take?", "How did you discover this bot?", "What is your personal mission statement?", "What are the top 2 compliments you hear from people about yourself?", "What came first, the chicken or the egg?", "How many licks does it take to get to the center of a tootsie pop?", "If animals could talk, which would be the rudest?", "What’s the most ridiculous fact you know?", "In one sentence, how would you sum up the internet?", "Is a hotdog a sandwich?", "If peanut butter wasn’t called peanut butter, what would it be called?", "What’s the best inside joke you’ve been a part of?", "Who is your role model?"];

if (total_sent_received == 0) {
 	for (var i = 0; i < initialQuestions.length; i++) {
		userAsking(null, users, questions, initialQuestions[i]);
 	}
}

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot');
});

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge']);
	}
	res.send('Error, wrong token');
});

// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'));
});

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    var text;
    var original_message;
    var found = false;
    var user_state;
    for (let i = 0; i < messaging_events.length; i++) {
    	
    	let event = req.body.entry[0].messaging[i];
	    let sender = event.sender.id;
	    found = sender in users;
	    if (!found) { // Keep track of total number of users
	    	total_users++;
	    }

	   	if (event.postback) { // handles menu clicks
	   		handlePostbacks(event.postback.payload, sender);
	   	}

	   	if (event.message && event.message.attachments) { // If a user trys to send a link, attachment, or sticker
	   		sendTextMessage(sender, "Sorry, I don't accept links, stickers, or attachments. \n \n Do you want to ask or answer a question?", true);
			setPrompt(sender, users);
	   	}
    	
    	// Find the current user
	    found = sender in users;
	    if(found) {
	    	user_state = users[sender].state;
	    } else {
	    	promptUser(sender, users);
	    }
	    
	    if(event.message && event.message.text && found) { // If the user sends a message
			
			usageInfo();

	    	text = event.message.text;
	    	original_message = sanitizeInput(text);
	    	text = text.toLowerCase();
 	    		    	
	    	// User has requested to answer a question and is now answering
	    	if(user_state == "prompted" && text != "ask" && text != "answer") {
	    		promptUser(sender, users);
	    	}
	    	else if (user_state == "answering") {
	    		userAnswering(sender, users, questions, original_message);
	    	}  
	    	// User has requested to ask a question and is now asking
	    	else if (user_state == "asking") {
	    		userAsking(sender, users, questions, original_message);
	    	} 
	    	// User has typed 'ask' or some variation of that
	    	else if (text.includes("ask") && user_state == "prompted"){
	    	 	userWantsToAsk(sender, users);
	    	} 
	    	// User wants to answer
		    else if (found && text.includes("answer") && user_state == "prompted") {
	    		giveUserQuestion(sender, users, questions);
	    	} 
	    	else if (found) {
	    		promptUser(sender, users);
	    	}
	    }
    }
    res.sendStatus(200)
});

function sendTextMessage(sender, text, quick_reply) {
	
	total_sent_received++; 
	var messageData;
	
	if (quick_reply) {
	    messageData = {  
	    					"text":text, 
	    					"quick_replies":[
	    							{"content_type":"text", "title": "Ask", "payload":"ASK_PAYLOAD"},
					          		{"content_type":"text", "title":"Answer", "payload":"ANSWER_PAYLOAD"}
					       		]
							}
	} else {
		messageData = { "text":text};
	}
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
    });
}

// Asks user if they want to answer a question
// Creates a new user
function promptUser(sender, users) {
	setPrompt(sender, users);
	sendTextMessage(sender, "Do you want to ask or answer a question?", true);
}


//Gives the user a question to answer
function giveUserQuestion(sender, users, questions) {
	// If there are no questions waiting to be answered
	if (!questions[0]) {
		sendTextMessage(sender, "There are no more questions right now. Sorry! \n \n Why don't you try to ask a question? To do so, select Ask.", true);
	} else { // If there is a question 
		var index;
		for (index = 0; index < questions.length; index++) {
			if (questions[index].asker != sender) {
		 		break;
			} 
		}
		if (questions[index] == null || questions[index].question == null) {
	 		sendTextMessage(sender, "There are no more questions right now. Sorry! \n \n Why don't you try to ask a question? To do so, select Ask.", true);
		} else {
			var question = questions[index].question;
			users[sender].state = "answering";
			questions[index].answerer = sender;
			sendTextMessage(sender, "Please answer the following question.\n\n" + question, false);
		}
	}
}

// Handles when a user answers a question
function userAnswering(sender, users, questions, original_message) {
	
	total_questions_answered++;
	
	if (messageIsInappropriate(original_message)) {
		sendTextMessage(sender, "Hmm... There was something wrong with your answer \n\n Let's try that again", true);
		setPrompt(sender, users);
		return;
	}
	
	var index;

	for (index = 0; index < questions.length; index++) {
		if (questions[index].answerer == sender) {
			// Without a subscription, the bot will get banned if it messages users after 24 hours
			// of interaction. If we find a question that is 24 hours old, it must be removed.
			var cur_date = new Date();
			var question_date = questions[index].date;
			if ((Math.abs(cur_date - question_date) / 36e5) >= 23.5) { // 36e5 helps convert milliseconds to hours
				questions.splice(index, 1); // remove the question
				continue;
			} else {
				break;
			}
		}
	}
	// Send message to the asker with an answer
	// It would equal null if it is a repeat question. 
	if (questions[index] && questions[index].completed == false) {
		sendTextMessage(questions[index].asker, "You asked: " + questions[index].question + "\n \nThe answer is: " + original_message, true);
		questions[index].completed = true;
	}

	sendTextMessage(sender, "Thanks, I will send your answer to the asker. \n\nIn the meantime, do you want to ask or answer another question?", true);
	setPrompt(sender, users);

	var popped_question = questions.splice(index, 1); // Remove question from the array
	popped_question[0].answerer = null;
	questions.push(popped_question[0]);

}

// Handles when a user wants to ask a question
function userWantsToAsk(sender, users) {
	sendTextMessage(sender, "Please ask your question.", false);
	users[sender].state = "asking";
}

// handles when a user asks a question
function userAsking(sender, users, questions, original_message) {
	
	setPrompt(sender, users);

	total_questions_asked++;

	for (var i = original_message.length - 1; i > 0; i--) {
		if (original_message[i] == "?") {
			original_message = original_message.substring(0, original_message.length - 1);
		}
	}

	// User is confused asking questions
	if (original_message == "no" || original_message == "what" || original_message == "wat" || original_message == "whut" || original_message == "wut" || original_message == "stop" || original_message == "help" || original_message == "huh") {
		sendTextMessage(sender, "Hmmm... Maybe ask something else. \n \n Do you want to try again?", true);
		setPrompt(sender, users);
		return;
	}

	// If a user tries to send a link, change the question to a harmless, common one
	if (messageIsInappropriate(original_message)) {
		sendTextMessage(sender, "Hmmm... Maybe ask something else. \n \n Do you want to try again?", true);
		setPrompt(sender, users);
		return;
	}
	var cur_date = new Date();
	
	if (original_message.slice(-1) != '?') {
		original_message = original_message + "?"; 
	}
	if (sender in users) {
		questions.unshift({question: original_message, asker: sender, answerer: null, date: cur_date, completed: false});
		sendTextMessage(sender, "Thanks, I will get back to you shortly. \n\nIn the meantime, do you want to ask or answer another question?", true);
		setPrompt(sender, users);
	}
}

function setPrompt(sender, users) {
	users[sender] = {answerer: null, state: "prompted"};
}

// Keep track of total questions asked and answered
function usageInfo() {
	total_usage++;
	console.log("Total Usage = +" + total_usage);
	console.log("Questions Asked = " + total_questions_asked);
	console.log("Questions Answered = " + total_questions_answered);  
	
}

function sanitizeInput(text) {
	text = text.replace(/[*{}><]/g,""); // Sanitize string 
	return text;
}

function messageIsInappropriate(text) {
	
	// Restrict length a little bit
	if (text.length > 1000) {
		return true
	}
	// User might be trying to send a link
	if (text.includes(".com") || text.includes("www") || text.includes(".co") || text.includes("https://") || text.includes("http://")) {
			return true;
	}
	// User might be trying to send an e-mail
	// This regex was found on http://stackoverflow.com/questions/16424659/check-if-a-string-contains-an-email-address
	var re = /(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;
	if (re.test(text)) {
		return true;
	}
	text = text.toLowerCase();
	if (text.includes("@") && (text.includes("gmail") || text.includes("@hotmail") || text.includes("@yahoo") || text.includes(".edu"))) {
		return true;
	}
	// Detect user errors
	if (text == "answer" || text == "answr" || text == "ask" || text == "aswer" || text == "skip" || text == "pass") {
		return true;
	}
	// User is trying to send a phone number if true
	// This regex was found on http://stackoverflow.com/questions/16699007/regular-expression-to-match-standard-10-digit-phone-number
	re = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
	for(var i = 0; i < text.length; i++) {
		var possiblePhoneNumber = text.substring(i, i + 12); // pull out 12 characters for a 10 digit number with possible punctuation
		if (re.test(possiblePhoneNumber)) {
			return true;
		}
	}
	return false;
} 

function handlePostbacks(payload, sender) {
	
	if (payload == "GET_STARTED_PAYLOAD") {
	    sendTextMessage(sender, "Welcome! I will help you ask and answer questions with anyone around the world. How does that sound? :)", false);
	} else if (payload == "ABOUT_PAYLOAD") {
		sendTextMessage(sender, "Give or Take was developed by Linus Gordon starting April 19, 2017. The bot has been featured on the front page of Botlist, Qwazou, and more.\n\nFor questions, comments, or feedback, please post on http://www.facebook.com/GiveOrTakeChatbot", false);
	} else if (payload == "STATS_PAYLOAD") {
		sendTextMessage(sender, "The current version of Give or Take has:\n" + total_users + " users\n" + total_questions_asked + " Questions Asked\n" + total_questions_answered + " Answers Provided\n" + total_sent_received + " Messages Sent and Received", false);
	} else if (payload == "HELP_PAYLOAD") {
		sendTextMessage(sender, "Give or Take allows you to ask to ask and answer unfiltered questions with anyone on Facebook.\nIf you ask a question, I will reply with another user's answer. \nYou can also choose to answer other user's questions.", false);
	}
	setPrompt(sender, users);

}
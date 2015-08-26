/**
 * Welcome to Pebble.js!
 *
 * This is where you write your app.
 */

var UI = require('ui');
var Vector2 = require('vector2');
var Settings = require('settings');

// habitica API constants
var habiticaBaseUrl = 'https://habitica.com/api/v2';
var habiticaStatus = '/status'; //Returns the status of the server (up or down). Does not require authentication.
var habiticaGetUserTasksUrl = '/user/tasks';

// AJAX connection
var ajax = require('ajax');

// Set a configurable
Settings.config(
  { url: 'https://kdemerath.github.io/settings.html' },
  function(e) {
    console.log('opening configurable');
  },
  function(e) {
    console.log('closed configurable');
    // Show the raw response if parsing failed
    if (e.failed) {
      console.log(e.response);
    } else {
      var options = Settings.option();
      console.log(JSON.stringify(options));
      Settings.data(options);
    }
  }
);

// check habitica status
checkHabiticaStatus();

// get all tasks
var allTasks = [];
getUserTasks();

var main = new UI.Card({
  title: 'Pebble.js',
  icon: 'images/menu_icon.png',
  subtitle: 'Hello World!',
  body: 'Press any button.'
});

main.show();

main.on('click', 'up', function(e) {
  var sectionHabits = {
    title: 'Habits',
    items: []
  };
  var sectionDailies = {
    title: 'Dailies',
    items: []
  };
  var sectionToDos = {
    title: 'To-Dos',
    items: []
  };
  
  if(!allTasks){console.log('allTasks is undefined');} else {
  var allTasksPrep = allTasks.map(
    function(x) {
      x.title = x.text;
      return x;
    }
  );
  sectionHabits.items = allTasksPrep.filter(
    function(x){
      return x.type == 'habit';
    }
  );
  sectionDailies.items = allTasksPrep.filter(
    function(x){
      return x.type == 'daily';
    }
  );
  sectionToDos.items = allTasksPrep.filter(
    function(x){
      return x.type == 'todo';
    }
  );
  }
  
  var menu = new UI.Menu();
  menu.section(1, sectionHabits);
  menu.section(2, sectionDailies);
  menu.section(3, sectionToDos);
  
  menu.on('select', function(e) {
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
    scoreTaskUp(e.item);
  });
  menu.show();
});

main.on('click', 'select', function(e) {
  var wind = new UI.Window({
    fullscreen: true,
  });
  var textfield = new UI.Text({
    position: new Vector2(0, 65),
    size: new Vector2(144, 30),
    font: 'gothic-24-bold',
    text: 'Text Anywhere!',
    textAlign: 'center'
  });
  wind.add(textfield);
  wind.show();
});

main.on('click', 'down', function(e) {
  var card = new UI.Card();
  card.title('A Card');
  card.subtitle('Is a Window');
  card.body('The simplest window type in Pebble.js.');
  card.show();
});

function checkHabiticaStatus() {
  ajax(
    {
      url: habiticaBaseUrl + habiticaStatus,
      type: 'json'
    },
    function(data, status, request) {
      console.log('Habitica Server Status: ' + data.status);
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
}

function getUserTasks() {
  ajax(
    {
      url: habiticaBaseUrl + habiticaGetUserTasksUrl,
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      console.log('User tasks: ' + JSON.stringify(data));
      allTasks = data;
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
}

function scoreTaskUp(task) {
  if (task) {
    if (task.id) {
  ajax(
    {
      url: habiticaBaseUrl + habiticaGetUserTasksUrl + '/' + task.id + '/up',
      method: 'post',
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      console.log('Return value: ' + JSON.stringify(data));
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
    }
  }
}
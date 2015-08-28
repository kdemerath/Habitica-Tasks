/**
 * Welcome to Pebble.js!
 *
 * This is where you write your app.
 */

var UI = require('ui');
var Settings = require('settings');
var ajax = require('ajax');

// habitica API constants
var habiticaBaseUrl = 'https://habitica.com/api/v2';
var habiticaStatus = '/status'; //Returns the status of the server (up or down). Does not require authentication.
var habiticaGetUserTasksUrl = '/user/tasks';

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
if (!checkHabiticaStatus) {
  var cardNoServer = new UI.Card({
    title: 'Server unavaiable',
    body: 'habitica Server is not available. Please restart.'
  });
  cardNoServer.show();
} else if(!Settings.option('userId') || !Settings.option('apiToken') || Settings.option('userId') === '' || Settings.option('apiToken') === '') {
  var cardSettingsIncomplete = new UI.Card({
    title: 'Settings incomplete',
    body: 'Please enter your credentials in the settings.'
  });
  cardSettingsIncomplete.show();
} else {
  
  // get all tasks
  var allTasks = [];
  getUserTasks();
  
  // create start screen
  var main = new UI.Card({
    title: 'habitica',
    icon: 'images/habiticaTasks_icon28x28bw.png',
    subtitle: 'Tasks',
    body: 'Press down to view your tasks.'
  });
  main.show();
  
  main.on('click', 'down', function(e) {
    if (!allTasks) {
      var cardNoTasks = new UI.Card({
        title: 'No tasks',
        body: 'Please retry.'
      });
      cardNoTasks.show();
    } else {
      // create tasks menu
      var menuAllTasks = new UI.Menu();
      menuAllTasks = createTasksMenu();
      menuAllTasks.show();
    }
  });
}

function checkHabiticaStatus() {
  var serverIsUp = false;
  ajax(
    {
      url: habiticaBaseUrl + habiticaStatus,
      type: 'json',
      async: 'false'
    },
    function(data, status, request) {
      console.log('Habitica Server Status: ' + data.status);
      if (data.status == 'up') {serverIsUp = true;}
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
  return serverIsUp;
}

function createTasksMenu() {
    var menu = new UI.Menu();
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
    
    if(!allTasks){
      console.log('allTasks is undefined');
    } else {
      var allTasksPrep = allTasks.slice();
      console.log('allTasksPrep lenght ' + allTasksPrep.lenght);
      allTasksPrep = allTasksPrep.map(
        function(x) {
          x.title = x.text;
          return x;
        }
      );
      console.log('allTasksPrep lenght ' + allTasksPrep.lenght);
      sectionHabits.items = allTasksPrep.filter(
        function(x){
          return x.type == 'habit';
        }
      ).slice();
      console.log('sectionHabits.items lenght ' + sectionHabits.items.lenght);
      sectionDailies.items = allTasksPrep.filter(
        function(x){
          return x.type == 'daily';
        }
      ).slice();
      sectionToDos.items = allTasksPrep.filter(
        function(x){
          return x.type == 'todo';
        }
      ).slice();
      }
    
    menu.section(1, sectionHabits);
    menu.section(2, sectionDailies);
    menu.section(3, sectionToDos);
    
    menu.on('select', function(e) {
      console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
      console.log('The item is titled "' + e.item.title + '"');
      scoreTaskUp(e.item);
    });
    return menu;
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
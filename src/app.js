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
var habiticaGetUserAnonymized = '/user/anonymized';

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
  
  // get user object
  var user = {};
  getUserObject();
  
  // start menu
  var mainMenu = new UI.Menu({
    sections: [{
      title: 'Tasks',
      items: [{
        title: 'Habits' 
      }, {
        title: 'Dailies'
      }, {
        title: 'To-Dos'
      }]
    }, {
      title: 'User',
      items: [{
        title: 'Stats'
      }]
    }]
  });
  
  if (Pebble.getActiveWatchInfo) {
    mainMenu.highlightBackgroundColor = 'indigo';
  } else {
    mainMenu.highlightBackgroundColor = 'black';
  }

  mainMenu.on('select', function(e) {
    console.log('Selected section ' + e.sectionIndex + ' "' + e.section.title + '" item ' + e.itemIndex + ' "' + e.item.title + '"');
    if (!allTasks) {
      var cardNoTasks = new UI.Card({
        title: 'No tasks',
        body: 'Please retry.'
      });
      cardNoTasks.show();
    } else {
      switch (e.sectionIndex) {
        case 0: { // tasks
          // create tasks menu
          var menuAllTasks = new UI.Menu();
          if (Pebble.getActiveWatchInfo) {
            menuAllTasks.highlightBackgroundColor = 'indigo';
          } else {
            menuAllTasks.highlightBackgroundColor = 'black';
          }
          switch (e.itemIndex) {
            case 0: { // habits
              menuAllTasks = createTasksMenu('habit');
              break;
            }
            case 1: { // dailies
              menuAllTasks = createTasksMenu('daily');
              break;
            }
            case 2: { // to-dos
              menuAllTasks = createTasksMenu('todo');
              break;
            }
          }
          menuAllTasks.show();
          break;
        }
        case 1: { // user
          switch (e.itemIndex) {
            case 0: { // stats
              if (!user) {
                var cardNoUser = new UI.Card({
                  title: 'No user data',
                  body: 'No user data available. Please retry.'
                });
                cardNoUser.show();
              } else {
                var cardUserStats = new UI.Card({
                  title: 'User Stats',
                  body: 'Health: ' + Math.round(user.stats.hp) + '/' + user.stats.maxHealth + '\n' + 'Gold: ' + Math.trunc(user.stats.gp) + '\n' + 'Level: ' + user.stats.lvl + '\n' + 'Experience: ' + user.stats.exp + '/' + user.stats.toNextLevel
                });
                cardUserStats.show();
              }
              break;
            }
          }
          break;
        }
      }
    }
  });
  mainMenu.show();
  
  // create start screen
  var main = new UI.Card({
    title: 'habitica',
    icon: 'images/habiticaTasks_icon28x28bw.png',
    subtitle: 'Tasks',
    body: 'Press down to view your tasks.'
  });
  //main.show();
  
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
      if (Pebble.getActiveWatchInfo) {
        menuAllTasks.highlightBackgroundColor = 'indigo';
      } else {
        menuAllTasks.highlightBackgroundColor = 'black';
      }
      menuAllTasks = createTasksMenu();
      menuAllTasks.show();
    }
  });
  
  main.on('click', 'up', function(e) {
    
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

function createTasksMenu(section) {
  // initialize menu
  var menu = new UI.Menu();
  // initialize sections
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
  
  // get tasks from allTasks and put into sectionsXY
  if(!allTasks){
    console.log('allTasks is undefined');
  } else {
    
    // get copy of allTasks
    var allTasksPrep = allTasks.slice();
    
    // get only 'section' tasks
    if (!section) {
      console.log('Section not defined. Get all kind of tasks.');
      allTasksPrep = enrichTaskItemsByMenuFields(allTasksPrep);
      
      // put appropriate tasks into sections
      sectionHabits.items = allTasksPrep.filter(
        function(x){
          return x.type == 'habit';
        }
      ).slice();
      sectionDailies.items = allTasksPrep.filter(
        function(x){
          return x.type == 'daily' && !x.completed;
        }
      ).slice();
      sectionToDos.items = allTasksPrep.filter(
        function(x){
          return x.type == 'todo' && !x.completed;
        }
      ).slice();
      
      // put sections into menu
      menu.section(1, sectionHabits);
      menu.section(2, sectionDailies);
      menu.section(3, sectionToDos);
    } else {
      console.log('Section is "' + section + '". Get only these kind of tasks.');
      switch (section) {
        case 'habit': {
          sectionHabits.items = allTasksPrep.filter(
            function(x){
              return x.type == 'habit';
            }
          ).slice();
          sectionHabits.items = enrichTaskItemsByMenuFields(sectionHabits.items);
          menu.section(1, sectionHabits);
          break;
        }
        case 'daily': {
          sectionDailies.items = allTasksPrep.filter(
            function(x){
              var today = new Date();
              var startDate = new Date(x.startDate);
              console.log('heute ist ' + today + '. Start Datum war ' + startDate + '. Differenz ist ' + (today - startDate) + '. Das sind ' + Math.trunc((today - startDate)/(1000*60*60*24)) + ' Tage.');
              return x.type == 'daily' && !x.completed  && ((x.frequency == 'weekly' && x.repeat[habiticaWeekday()]) || (x.frequency == 'daily' && (Math.trunc((today - startDate)/(1000*60*60*24)) % x.everyX === 0)));
            }
          ).slice();
          sectionDailies.items = enrichTaskItemsByMenuFields(sectionDailies.items);
          menu.section(2, sectionDailies);
          break;
        }
        case 'todo': {
          sectionToDos.items = allTasksPrep.filter(
            function(x){
              return x.type == 'todo' && !x.completed;
            }
          ).slice();
          sectionToDos.items = enrichTaskItemsByMenuFields(sectionToDos.items);
          menu.section(3, sectionToDos);
          break;
        }
      }
    }
  }
  
  menu.on('select', function(e) {
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
    if (e.item.down === true) {
      console.log('The selected task has .down-item.');
      if (e.item.up === false) {
        console.log('The selected task has no .up-item.');
        scoreTaskDown(e.item);
      } else {
        var selectedTask = e;
        var cardUpDown = new UI.Card(
          {
            'title': e.item.type,
            'body': e.item.title
          }
        );
        cardUpDown.action({
          up: 'images/action_icon_plus.png',
          down: 'images/action_icon_minus.png'
        });
        cardUpDown.on('click', 'up', function(e) {
          console.log('cardUpDown click up');
          scoreTaskUp(selectedTask.item);
          cardUpDown.hide();
        });
        cardUpDown.on('click', 'down', function(e) {
          console.log('cardUpDown click down');
          scoreTaskDown(selectedTask.item);
          cardUpDown.hide();
        });
        cardUpDown.show();
      }
    } else {
      console.log('The selected task has no .down-item.');
      scoreTaskUp(e.item);
    }
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
    } else {
      console.log('Task id not available.');
    }
  } else {
    console.log('Task not available.');
  }
}

function scoreTaskDown(task) {
  if (task) {
    if (task.id) {
      ajax(
        {
          url: habiticaBaseUrl + habiticaGetUserTasksUrl + '/' + task.id + '/down',
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
    } else {
      console.log('Task id not available.');
    }
  } else {
    console.log('Task not available.');
  }
}

function getUserObject() {
  ajax(
    {
      url: habiticaBaseUrl + habiticaGetUserAnonymized,
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      console.log('User object: ' + JSON.stringify(data));
      user = data;
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + error);
    }
  );
}

function enrichTaskItemsByMenuFields(tasksArray) {
  // enrich tasks by menu relevant fields
  tasksArray = tasksArray.map(
    function(x) {
      x.title = x.text;
      if (x.text.length > 14) {
        if (x.text.length > 20) {
          x.subtitle = '...' + x.text.substring(15);
        } else {
          x.subtitle = x.text;
        }
      } else {
        x.subtitle = x.text;
      }
      return x;
    }
  );
  return tasksArray;
}

function habiticaWeekday(date) {
  var weekday = new Array(7);
  weekday[0] = "su";
  weekday[1] = "m";
  weekday[2] = "t";
  weekday[3] = "w";
  weekday[4] = "th";
  weekday[5] = "f";
  weekday[6] = "s";
  
  if (!date) {
    var today = new Date();
    return weekday[today.getDay()];
  } else {
    return weekday[date.getDay()];
  }
}

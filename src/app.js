/**
 * Welcome to Pebble.js!
 *
 * This is where you write your app.
 */

var UI = require('ui');
var Settings = require('settings');
var ajax = require('ajax');
var Feature = require('platform/feature');

// habitica API constants
var habiticaBaseUrl = 'https://habitica.com/api/v2';
var habiticaStatus = '/status'; //Returns the status of the server (up or down). Does not require authentication.
var habiticaGetUserTasksUrl = '/user/tasks';
var habiticaGetUserAnonymized = '/user/anonymized';

// Set a configurable
Settings.config(
  { url: 'https://kdemerath.github.io/settings.html' },
  function(e) {
    //console.log('opening configurable');
  },
  function(e) {
    //console.log('closed configurable');
    // Show the raw response if parsing failed
    if (e.failed) {
      console.log(e.response);
    } else {
      var options = Settings.option();
      //console.log(JSON.stringify(options));
      Settings.data(options);
    }
  }
);

// check habitica status
if (!checkHabiticaStatus) {
  var cardNoServer = new UI.Card({
    title: 'Server unavaiable',
    body: 'habitica Server is not available. Please restart.',
    scrollable: true
  });
  cardNoServer.show();
} else if(!Settings.option('userId') || !Settings.option('apiToken') || Settings.option('userId') === '' || Settings.option('apiToken') === '') {
  var cardSettingsIncomplete = new UI.Card({
    title: 'Settings incomplete',
    body: 'Please enter your credentials in the settings.',
    scrollable: true
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
    highlightBackgroundColor: Feature.color('indigo', 'black'),
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
  
  /*if (Pebble.getActiveWatchInfo) {
    mainMenu.highlightBackgroundColor = 'indigo';
  } else {
    mainMenu.highlightBackgroundColor = 'black';
  }*/
  //mainMenu.highlightBackgroundColor = Feature.color('indigo', 'black');

  mainMenu.on('select', function(e) {
    //console.log('Selected section ' + e.sectionIndex + ' "' + e.section.title + '" item ' + e.itemIndex + ' "' + e.item.title + '"');
    if (!allTasks) {
      console.log('No tasks available');
      var cardNoTasks = new UI.Card({
        title: 'No tasks',
        body: 'Please retry.'
      });
      cardNoTasks.show();
    } else {
      //console.log('Tasks available');
      switch (e.sectionIndex) {
        case 0: { // tasks
          // create tasks menu
          var menuAllTasks = new UI.Menu({
            highlightBackgroundColor: Feature.color('indigo', 'black')
          });
          /*if (Pebble.getActiveWatchInfo) {
            menuAllTasks.highlightBackgroundColor = 'indigo';
          } else {
            menuAllTasks.highlightBackgroundColor = 'black';
          }*/
          //menuAllTasks.highlightBackgroundColor = Feature.color('indigo', 'black');
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
                console.log('No user data available');
                var cardNoUser = new UI.Card({
                  title: 'No user data',
                  body: 'No user data available. Please retry.'
                });
                cardNoUser.show();
              } else {
                /*console.log('User data available');
                console.log('Health: ' + Math.round(user.stats.hp));
                console.log('MaxHealth' + user.stats.maxHealth);
                console.log('Gold: ' + Math.floor(user.stats.gp));
                console.log('Level: ' + user.stats.lvl);
                console.log('Experience: ' + user.stats.exp);
                console.log('toNextLevel' + user.stats.toNextLevel);
                console.log('Mana: ' + Math.floor(user.stats.mp));
                console.log('maxMP' + user.stats.maxMP);*/
                var cardUserStats = new UI.Card({
                  title: 'User Stats',
                  body: 'Health: ' + Math.round(user.stats.hp) + '/' + user.stats.maxHealth + '\n' + 'Experience: ' + user.stats.exp + '/' + user.stats.toNextLevel + ((user.stats.lvl >= 10) ? '\n' + 'Mana: ' + Math.floor(user.stats.mp) + '/' + user.stats.maxMP : '') + '\n' + 'Gold: ' + Math.floor(user.stats.gp) + '\n' + 'Level: ' + user.stats.lvl,
                  scrollable: true
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
  var menu = new UI.Menu({
    highlightBackgroundColor: Feature.color('indigo', 'black')
  });
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
      //console.log('Section not defined. Get all kind of tasks.');
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
      //console.log('Section is "' + section + '". Get only these kind of tasks.');
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
              //console.log('heute ist ' + today + '. Start Datum war ' + startDate + '. Differenz ist ' + (today - startDate) + '. Das sind ' + Math.floor((today - startDate)/(1000*60*60*24)) + ' Tage.');
              return x.type == 'daily' && !x.completed  && ((x.frequency == 'weekly' && x.repeat[habiticaWeekday()]) || (x.frequency == 'daily' & startDate < today && (Math.floor((today - startDate)/(1000*60*60*24)) % x.everyX === 0)));
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
    //console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    //console.log('The item is titled "' + e.item.title + '"');
    if (e.item.down === true) {
      //console.log('The selected task has .down-item.');
      if (e.item.up === false) {
        //console.log('The selected task has no .up-item.');
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
          //console.log('cardUpDown click up');
          scoreTaskUp(selectedTask.item);
          cardUpDown.hide();
        });
        cardUpDown.on('click', 'down', function(e) {
          //console.log('cardUpDown click down');
          scoreTaskDown(selectedTask.item);
          cardUpDown.hide();
        });
        cardUpDown.show();
      }
    } else {
      //console.log('The selected task has no .down-item.');
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
      //console.log('User tasks: ' + JSON.stringify(data));
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
          //console.log('Return value: ' + JSON.stringify(data));
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
          //console.log('Return value: ' + JSON.stringify(data));
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
      //console.log('User object: ' + JSON.stringify(data));
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
      var strChecklist = '';
      if (typeof x.checklist !== 'undefined' && x.checklist.length > 0) {
        var checkedItems = x.checklist.filter(function(value) {
          return value.completed;
        }).length;
        strChecklist = checkedItems + '/' + x.checklist.length;
      }
      x.title = x.text;
      if (x.text.length > 14) {
        if (x.text.length > 20) {
          if (strChecklist === '') {
            x.subtitle = '...' + x.text.substring(15);
          } else {
            x.subtitle = '...' + x.text.substring(15, 30) + ' ' + strChecklist;
          }
        } else {
          x.subtitle = x.text + ' ' + strChecklist;
        }
      } else {
        x.subtitle = x.text + ' ' + strChecklist;
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

function getMatchingStr4MenuItemTitle(input) {
  var output = '';
  var charWidth = new Array([]);
  charWidth[97] = 9;
  charWidth[98] = 9;
  charWidth[99] = 9;
  charWidth[100] = 9;
  charWidth[101] = 9;
  charWidth[102] = 7;
  charWidth[103] = 9;
  charWidth[104] = 9;
  charWidth[105] = 4;
  charWidth[106] = 4;
  charWidth[107] = 9;
  charWidth[108] = 4;
  charWidth[109] = 14;
  charWidth[110] = 9;
  charWidth[111] = 9;
  charWidth[112] = 9;
  charWidth[113] = 9;
  charWidth[114] = 7;
  charWidth[115] = 7;
  charWidth[116] = 7;
  charWidth[117] = 9;
  charWidth[118] = 9;
  charWidth[119] = 11;
  charWidth[120] = 9;
  charWidth[121] = 9;
  charWidth[122] = 7;
  
  for (var i = 0; i < input.length; i++){
    
  }
  return output;
}
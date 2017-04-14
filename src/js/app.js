/**
 * Welcome to Habitica Tasks
 *
 *
 */

var UI = require('ui');
var Settings = require('settings');
var ajax = require('ajax');
var Feature = require('platform/feature');
var timelineToken = '';

// habitica API constants
var habiticaBaseUrl = 'https://habitica.com/api/v3';
var habiticaStatus = '/status'; //Returns the status of the server (up or down). Does not require authentication.
var habiticaGetTasksUser = '/tasks/user';
//var habiticaGetUserAnonymized = '/user/anonymized';
var habiticaGetUser = '/user';
var habiticaPostTasksScore = '/tasks/:taskId/score/:direction';
var habiticaPostTasksChecklistScore = '/tasks/:taskId/checklist/:itemId/score';

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
  
  // get timeline token
  Pebble.getTimelineToken(function(token) {
    console.log('My timeline token is ' + token);
    timelineToken = token;
    
    // Send tasks to the timeline now that we have our token
    if (allTasks){
      allTasks.map(postToTimeline);
    }
  }, function(error) {
    console.log('Error getting timeline token: ' + error);
  });
  
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
                  body: 'Health: ' + Math.round(user.stats.hp) + '/' + user.stats.maxHealth + '\n' + 'Experience: ' + Math.round(user.stats.exp) + '/' + user.stats.toNextLevel + ((user.stats.lvl >= 10) ? '\n' + 'Mana: ' + Math.floor(user.stats.mp) + '/' + user.stats.maxMP : '') + '\n' + 'Gold: ' + Math.floor(user.stats.gp) + '\n' + 'Level: ' + user.stats.lvl,
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
      if (data.success){
        console.log('Habitica Server Status: ' + data.data.status);
        if (data.data.status == 'up') {serverIsUp = true;}
      } else {
        console.log(data.error + ' - ' + data.message);
      }
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
      menu.section(0, sectionHabits);
      menu.section(1, sectionDailies);
      menu.section(2, sectionToDos);
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
          menu.section(0, sectionHabits);
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
          menu.section(0, sectionDailies);
          break;
        }
        case 'todo': {
          sectionToDos.items = allTasksPrep.filter(
            function(x){
              return x.type == 'todo'; // should nout be necessary any more && !x.completed;
            }
          ).slice();
          sectionToDos.items = enrichTaskItemsByMenuFields(sectionToDos.items);
          menu.section(0, sectionToDos);
          break;
        }
      }
    }
  }
  
  menu.on('longSelect', function(e) {
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
      scoreTaskUp(e.item);
      menu.hide();
    }
  });
  
  menu.on('select', function(e) {
    //console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    //console.log('The item is titled "' + e.item.title + '"');
    if (e.item.down === true) {
      //console.log('The selected task has .down-item.');
      if (e.item.up === false) {
        //console.log('The selected task has no .up-item.');
        scoreTaskDown(e.item);
        menu.hide();
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
      //console.log('Selected item is:' + JSON.stringify(e.item));
      if (typeof e.item.checklist !== 'undefined' && e.item.checklist.length > 0) {
        // access checklist
        var checklistMenu = new UI.Menu({
          highlightBackgroundColor: Feature.color('indigo', 'black')
        });
        // initialize sections
        var sectionChecklist = {
        title: 'Checklist',
        items: []
        };
        sectionChecklist.items = e.item.checklist.slice();
        sectionChecklist.items = enrichChecklistItemsByMenuFields(sectionChecklist.items, e.item.id);
        checklistMenu.section(0, sectionChecklist);
        //console.log(JSON.stringify(sectionChecklist)); // remove
        checklistMenu.on('select', function(e) {
          scoreChecklistItem(e.item);
        });
        checklistMenu.show();
        // scoreTaskUp(e.item); //remove when ready
      } else {
        // no checklist available -> just score the task
        scoreTaskUp(e.item); 
        menu.hide();
      }
    }
  });
  return menu;
}

function scoreChecklistItem(checklistItem) {
  if (checklistItem) {
    if (checklistItem.id) {
      ajax(
        {
          url: habiticaBaseUrl + habiticaPostTasksChecklistScore.replace(':taskId', checklistItem.taskId).replace(':itemId', checklistItem.id),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
            
          } else {
            console.log(data.error + ' - ' + data.message);
          }
        },
        function(error, status, request) {
          console.log('The ajax request failed: ' + error);
        }
      );
    } else {
      console.log('Checklist item id not available.');
    }
  } else {
    console.log('Checklist item not available.');
  }
}

function enrichChecklistItemsByMenuFields(checklistArray, taskId) {
  // enrich tasks by menu relevant fields
  checklistArray = checklistArray.filter(
    function(x) {
      return !x.completed;
    }
  );
  checklistArray = checklistArray.map(
    function(x) {
      x.title = x.text;
      x.taskId = taskId;
      if (x.text.length > 20) {
        x.subtitle = '...' + x.text.substring(15);
      } else {
        x.subtitle = x.text;
      }
      
      return x;
    }
  );
  return checklistArray;
}

function getUserTasks() {
  ajax(
    {
      url: habiticaBaseUrl + habiticaGetTasksUser,
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      if (data.success){
        //console.log('User tasks: ' + JSON.stringify(data));
        allTasks = data.data;
        
        // Send them to the timeline
        allTasks.map(postToTimeline);
      } else {
        console.log(data.error + ' - ' + data.message);
      }
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
          url: habiticaBaseUrl + habiticaPostTasksScore.replace(':taskId', task.id).replace(':direction', 'up'),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
            //console.log(JSON.stringify(task));
            
            // Figure out how much we got
            var addedGold = data.data.gp - user.stats.gp;
            var addedXp = data.data.exp - user.stats.exp;
            
            // update users stats
            user.stats.hp = data.data.hp;
            user.stats.mp = data.data.mp;
            user.stats.exp = data.data.exp;
            user.stats.gp = data.data.gp;
            user.stats.lvl = data.data.lvl;
            
            // Show confirmation
            var cardShowScore = new UI.Card({
              title: 'Woot!',
              body: 'Recieved ' + addedGold.toFixed(2).toString() + ' gp and ' +
                    addedXp.toString() + ' XP for completing ' +
                    task.type + ' ' + task.title + '!',
              scrollable: true
            });
            cardShowScore.show();
            
            // Drop from timeline (if todo)
            if (task.type == 'todo'){
              ajax(
              {
                url: 'https://timeline-api.getpebble.com/v1/user/pins/habitica-' + task.id,
                method: 'delete',
                type: 'text',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Token': timelineToken
                },
              },
              function(data, status, request) {
                //console.log("Timeline DELETE success");
              },
              function(error, status, request) {
                console.log('Timeline Failed: Unable to DELETE to timeline Error:' + JSON.stringify(error) + ' Status: ' + status.toString() + ' Request: ' + JSON.stringify(request));
                //new UI.Card({title:'Timeline Failed', scrollable: true,
                  //           body:'Unable to DELETE to timeline Error:' + JSON.stringify(error) + ' Status: ' + status.toString() + ' Request: ' + JSON.stringify(request)}).show(); 
              }
            );
            }
            
            
            // Refresh tasks
            getUserTasks();          
            
          } else {
            console.log(data.error + ' - ' + data.message);
          }
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
          url: habiticaBaseUrl + habiticaPostTasksScore.replace(':taskId', task.id).replace(':direction', 'down'),
          method: 'post',
          type: 'json',
          headers: {
            'x-api-user': Settings.option('userId'),
            'x-api-key': Settings.option('apiToken')
          }
        },
        function(data, status, request) {
          if (data.success){
            //console.log('User tasks: ' + JSON.stringify(data));
            //console.log(JSON.stringify(task));
            
            // Figure out how much we got
            var removedHp = -(data.data.hp - user.stats.hp);
            
            // update users stats
            user.stats.hp = data.data.hp;
            user.stats.mp = data.data.mp;
            user.stats.exp = data.data.exp;
            user.stats.gp = data.data.gp;
            user.stats.lvl = data.data.lvl;
            
            // Show confirmation
            var cardShowScore = new UI.Card({
              title: 'Ouch',
              body: 'Lost ' + removedHp.toFixed(1).toString() + ' HP for ' +
                    task.type + ' ' + task.title + '.',
              scrollable: true
            });
            cardShowScore.show();
            
            // Refresh tasks
            getUserTasks(); 
          } else {
            console.log(data.error + ' - ' + data.message);
          }
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
      url: habiticaBaseUrl + habiticaGetUser,
      type: 'json',
      headers: {
        'x-api-user': Settings.option('userId'),
        'x-api-key': Settings.option('apiToken')
      }
    },
    function(data, status, request) {
      if (data.success){
        //console.log('User object: ' + JSON.stringify(data));
        user = data.data;
      } else {
        console.log(data.error + ' - ' + data.message);
      }
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
      
      
      if (x.up || x.down){
        // This is a habit with up/down counters
        // Figure out how many times checked this day/week/month
        if (x.down && x.up){
          x.subtitle = "+" + x.counterUp.toString() + "/-" + x.counterDown.toString(); 
        }else if (x.down){
          x.subtitle = x.counterDown.toString();        
        }else{
          x.subtitle = x.counterUp.toString();
        }
        
        var freq = x.frequency;
        if (x.frequency == 'daily') { freq = 'today'; }
        else if (x.frequency == 'weekly') { freq = 'this week'; }
        else if (x.frequency == 'monthly') { freq = 'this month'; }
        if (x.subtitle == '1'){
          x.subtitle += " time " + freq;
        }else{
          x.subtitle += " times " + freq;
        }        
      }else if (x.streak){
        // This is a daily with a streak
        x.subtitle = x.streak.toString() + " day streak";
      }else if (x.date){
        // This is a todo with a due date
        x.subtitle = "Due " + x.date.slice(0,10);
      }     
      
      return x;
    }
  );
  return tasksArray;
}

function postToTimeline(task) {
  // Token hasn't loaded yet
  if (timelineToken === '') {
    return;
  }
  
  // Don't put habits or rewards on the timeline
  if (task.type == 'habit'){    
    return;
  }  
  if (task.type == 'reward'){
    return;
  }
  
  // Only put incomplete dailys due today
  if (task.type == 'daily'){
    var today = new Date();
    var startDate = new Date(task.startDate);

    if (!(task.type == 'daily' && !task.completed  && 
        ((task.frequency == 'weekly' && task.repeat[habiticaWeekday()]) || 
         (task.frequency == 'daily' & startDate < today && (Math.floor((today - startDate)/(1000*60*60*24)) % task.everyX === 0))))){
      // Drop this task if it's on the timeline for some reason (maybe recently got deleted)
      ajax(
        {
          url: 'https://timeline-api.getpebble.com/v1/user/pins/habitica-' + task.id,
          method: 'delete',
          type: 'text',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': timelineToken
          },
        },
        function(data, status, request) {
          //console.log("Timeline DELETE success");
        },
        function(error, status, request) {
          console.log('Timeline Failed: Unable to DELETE to timeline Error:' + JSON.stringify(error) + ' Status: ' + status.toString() + ' Request: ' + JSON.stringify(request));
          //new UI.Card({title:'Timeline Failed', scrollable: true,
            //           body:'Unable to DELETE to timeline Error:' + JSON.stringify(error) + ' Status: ' + status.toString() + ' Request: ' + JSON.stringify(request)}).show(); 
        }
      );
      
      return;
    }

  }
  
  var taskDate = new Date();  
  taskDate.setHours(12,0,0);
  
  if (task.date){
    taskDate = new Date(Date.parse(task.date));
    // Set to noon on date due
    taskDate.setHours(12,0,0);
  }
  /*console.log('Try to PUT this to timeline: ' + JSON.stringify({
      url: 'https://timeline-api.getpebble.com/v1/user/pins/habitica-' + task.id,
      method: 'put',
      type: 'text',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': timelineToken
      },
      data: JSON.stringify({
        "id": "habitica-" + task.id,
        "time": taskDate,
        "layout": {
          "type": "genericPin",
          "title": task.text,
          "body": task.notes + " (" + task.type + ")",
          "tinyIcon": "system://images/GENERIC_CONFIRMATION"
        }
      })
    }));*/
  
  ajax(
    {
      url: 'https://timeline-api.getpebble.com/v1/user/pins/habitica-' + task.id,
      method: 'put',
      type: 'text',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': timelineToken
      },
      data: JSON.stringify({
        "id": "habitica-" + task.id,
        "time": taskDate,
        "layout": {
          "type": "genericPin",
          "title": task.text,
          "body": task.notes + " (" + task.type + ")",
          "tinyIcon": "system://images/GENERIC_CONFIRMATION"
        }
      })
    },
    function(data, status, request) {
      //new UI.Card({title:'Timeline Success', body:'Posted: ' + JSON.stringify(data)}).show();
      //console.log("Timeline PUT success");
    },
    function(error, status, request) {
      console.log('Timeline Failed: Unable to PUT to timeline Error:' + JSON.stringify(error) + ' Status: ' + status.toString() + ' Request: ' + JSON.stringify(request));
      //new UI.Card({title:'Timeline Failed', scrollable: true,
        //           body:'Unable to PUT to timeline Error:' + JSON.stringify(error) + ' Status: ' + status.toString() + ' Request: ' + JSON.stringify(request)}).show(); 
    }
  );
  
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

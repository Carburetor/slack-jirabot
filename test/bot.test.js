'use strict';

const test = require('blue-tape');
const Bot = require(process.env.PWD + '/lib/bot');
const configDist = require(process.env.PWD + '/config.default.js');

test('Bot: instantiate and set config', (assert) => {
  const bot = new Bot(configDist);
  assert.equal(bot.config, configDist);
  assert.end();
});

test('Bot: build issue links', (assert) => {
  const bot = new Bot(configDist);
  const issueKey = 'Test-1';
  const expectedLink = `https://jira.yourhost.domain:443/browse/${issueKey}`;

  assert.equal(bot.buildIssueLink(issueKey), expectedLink);
  assert.end();
});

test('Bot: build issue links correctly with base', (assert) => {
  configDist.jira.base = 'foo';
  const bot = new Bot(configDist);
  const issueKey = 'TEST-1';
  const expectedLink = `https://jira.yourhost.domain:443/foo/browse/${issueKey}`;
  assert.equal(bot.buildIssueLink(issueKey), expectedLink);
  assert.end();
});

test('Bot: parse a sprint name from greenhopper field', (assert) => {
  const bot = new Bot(configDist);
  const sprintName = 'TEST';
  const exampleSprint = [
    `derpry-derp-derp,name=${sprintName},foo`,
  ];

  assert.equal(bot.parseSprint(exampleSprint), sprintName);
  assert.notOk(bot.parseSprint(['busted']));
  assert.end();
});

test('Bot: parse a sprint name from the last sprint in the greenhopper field', (assert) => {
  const bot = new Bot(configDist);
  const sprintName = 'TEST';
  const exampleSprint = [
    `derpry-derp-derp,name=${sprintName}1,foo`,
    `derpry-derp-derp,name=${sprintName}2,foo`,
    `derpry-derp-derp,name=${sprintName}3,foo`,
  ];

  assert.equal(bot.parseSprint(exampleSprint), sprintName + '3');
  assert.end();
});

test('Bot: translate a jira username to a slack username', (assert) => {
  configDist.usermap = {
    'foo': 'bar',
    'fizz': 'buzz',
    'ping': 'pong',
  };

  const bot = new Bot(configDist);

  assert.equal(bot.jira2Slack('foo'), '@bar');
  assert.equal(bot.jira2Slack('ping'), '@pong');
  assert.notOk(bot.jira2Slack('blap'));
  assert.end();
});

test('Bot: parse unique jira tickets from a message', (assert) => {
  const bot = new Bot(configDist);
  assert.deepEqual(bot.parseTickets('Chan', 'blarty blar TEST-1'), ['TEST-1']);
  assert.deepEqual(bot.parseTickets('Chan', 'blarty blar TEST-2 TEST-2'), ['TEST-2']);
  assert.deepEqual(bot.parseTickets('Chan', 'blarty blar TEST-3 TEST-4'), ['TEST-3', 'TEST-4']);
  assert.deepEqual(bot.parseTickets('Chan', 'blarty blar Test-1 Test-1'), []);
  assert.end();
});

test('Bot: handle empty message/channel', (assert) => {
  const bot = new Bot(configDist);
  assert.deepEqual(bot.parseTickets('Chan', null), []);
  assert.deepEqual(bot.parseTickets(null, 'Foo'), []);
  assert.end();
});

test('Bot: populate the ticket buffer', (assert) => {
  const bot = new Bot(configDist);
  const ticket = 'TEST-1';
  const channel = 'Test';
  const hash = bot.hashTicket(channel, ticket);

  assert.deepEqual(bot.parseTickets(channel, 'foo ' + ticket), [ticket]);
  assert.ok(bot.ticketBuffer.get(hash));

  // Expect the ticket to not be repeated
  assert.deepEqual(bot.parseTickets(channel, 'foo ' + ticket), []);
  assert.end();
});

test('Bot: respond to the same ticket in different channels', (assert) => {
  const bot = new Bot(configDist);
  const ticket = 'TEST-1';
  const channel1 = 'Test1';
  const channel2 = 'Test2';

  assert.deepEqual(bot.parseTickets(channel1, 'foo ' + ticket), [ticket]);
  assert.deepEqual(bot.parseTickets(channel2, 'foo ' + ticket), [ticket]);
  assert.end();
});

test('Bot: cleanup the ticket buffer', (assert) => {
  const bot = new Bot(configDist);
  const ticket = 'TEST-1';
  const channel = 'Test';
  const hash = bot.hashTicket(channel, ticket);

  assert.deepEqual(bot.parseTickets(channel, 'foo ' + ticket), [ticket]);
  assert.ok(bot.ticketBuffer.get(hash));

  // set the Ticket Buffer Length low to trigger the cleanup
  bot.TICKET_BUFFER_LENGTH = -1;
  bot.cleanupTicketBuffer();
  assert.notOk(bot.ticketBuffer.get(hash));

  assert.end();
});

test('Bot: return a default description if empty', (assert) => {
  const bot = new Bot(configDist);
  assert.equal(bot.formatIssueDescription(''), 'Ticket does not contain a description');
  assert.end();
});

test('Bot: replace quotes', (assert) => {
  const bot = new Bot(configDist);
  assert.equal(bot.formatIssueDescription('{quote}foo{quote}'), '```foo```');
  assert.end();
});

test('Bot: replace code blocks', (assert) => {
  const bot = new Bot(configDist);
  assert.equal(bot.formatIssueDescription('{code}foo{code}'), '```foo```');
  assert.end();
});

test('Bot: show custom fields', (assert) => {
  assert.plan(5);
  const issue = {
    key: 'TEST-1',
    fields: {
      created: '2015-05-01T00:00:00.000',
      updated: '2015-05-01T00:01:00.000',
      summary: 'Blarty',
      description: 'Foo foo foo foo foo foo',
      status: {
        name: 'Open',
      },
      priority: {
        name: 'Low',
      },
      reporter: {
        name: 'bob',
        displayName: 'Bob',
      },
      assignee: {
        name: 'fred',
        displayName: 'Fred',
      },
      customfield_10000: 'Fizz',
      customfield_10001: [
        { value: 'Buzz' },
      ],
    },
  };

  // Add some custom fields
  configDist.jira.customFields.customfield_10000 = 'CF1';
  configDist.jira.customFields['customfield_10001[0].value'] = 'CF2';
  configDist.jira.customFields['customfield_10003 && exit()'] = 'Nope1';
  configDist.jira.customFields['customfield_10004; exit()'] = 'Nope2';
  configDist.jira.customFields.customfield_10005 = 'Nope3';

  const bot = new Bot(configDist);
  const response = bot.issueResponse(issue);

  let x;
  for (x in response.fields) {
    if (response.fields.hasOwnProperty(x)) {
      switch (response.fields[x].title) {
        case configDist.jira.customFields.customfield_10000:
          assert.equal(response.fields[x].value, issue.fields.customfield_10000);
          break;
        case configDist.jira.customFields['customfield_10001[0].value']:
          assert.equal(response.fields[x].value, issue.fields.customfield_10001[0].value);
          break;
        case configDist.jira.customFields['customfield_10003 && exit()']:
          assert.equal(response.fields[x].value, 'Invalid characters in customfield_10003 && exit()');
          break;
        case configDist.jira.customFields['customfield_10004; exit()']:
          assert.equal(response.fields[x].value, 'Invalid characters in customfield_10004; exit()');
          break;
        case configDist.jira.customFields.customfield_10005:
          assert.equal(response.fields[x].value, 'Unable to read customfield_10005');
          break;
        default:
          // nothing to see here
      }
    }
  }
});

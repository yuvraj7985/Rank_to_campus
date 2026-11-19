import test from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../src/models/Notification.js';
import { createNotification, listNotifications, markRead } from '../src/controllers/notification.controller.js';

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('notification read updates are restricted to the signed-in audience', async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  let filter;
  Notification.findOneAndUpdate = (query) => {
    filter = query;
    return { lean: async () => null };
  };

  try {
    const response = makeResponse();
    await markRead(
      { params: { id: 'notice-id' }, user: { _id: 'student-id', role: 'student' } },
      response,
      (error) => { throw error; }
    );

    assert.deepEqual(filter, {
      _id: 'notice-id',
      audience: { $in: ['all', 'student'] }
    });
    assert.equal(response.statusCode, 404);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('notification creation rejects blank content and invalid audiences', async () => {
  const originalCreate = Notification.create;
  let created = false;
  Notification.create = async () => {
    created = true;
    return {};
  };

  try {
    const emptyResponse = makeResponse();
    await createNotification(
      { body: { title: '  ', message: 'text' }, user: { _id: 'admin-id' } },
      emptyResponse,
      (error) => { throw error; }
    );
    assert.equal(emptyResponse.statusCode, 400);

    const audienceResponse = makeResponse();
    await createNotification(
      { body: { title: 'Notice', message: 'Text', audience: 'private' }, user: { _id: 'admin-id' } },
      audienceResponse,
      (error) => { throw error; }
    );
    assert.equal(audienceResponse.statusCode, 400);
    assert.equal(created, false);
  } finally {
    Notification.create = originalCreate;
  }
});

test('notification unread count is scoped to the current role and user', async () => {
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;
  let listFilter;
  let countFilter;
  Notification.find = (filter) => {
    listFilter = filter;
    return {
      sort: () => ({
        limit: () => ({
          lean: async () => [{
            _id: 'notice-id',
            title: 'Update',
            readBy: ['another-user']
          }]
        })
      })
    };
  };
  Notification.countDocuments = async (filter) => {
    countFilter = filter;
    return 3;
  };

  try {
    const response = makeResponse();
    await listNotifications(
      { user: { _id: 'student-id', role: 'student' } },
      response,
      (error) => { throw error; }
    );

    assert.deepEqual(listFilter, { audience: { $in: ['all', 'student'] } });
    assert.deepEqual(countFilter, {
      audience: { $in: ['all', 'student'] },
      readBy: { $ne: 'student-id' }
    });
    assert.equal(response.body.unreadCount, 3);
    assert.equal(response.body.data[0].isRead, false);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  }
});

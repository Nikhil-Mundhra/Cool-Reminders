/* db.mjs */
/* Mongo connection and data models for Cool Reminders */

import mongoose from 'mongoose';
import { info, err } from './routes/utils/log.mjs';

let hasAttachedConnectionListeners = false;

/* -------------------------------------------------------------------------- */
/* Connection helper                                                          */
/* -------------------------------------------------------------------------- */

/*
  connectDB

  Opens a single shared mongoose connection if one is not already open.

  - Uses the provided dsn argument, or process.env.DSN if dsn is missing.
  - Sets strictQuery to false to keep query casting flexible.
  - Attaches connection lifecycle listeners once for logging.
  - Respects mongoose.connection.readyState so repeat calls reuse the
    existing connection instead of opening a new one.

  Returns the active mongoose.connection instance or throws if the
  initial connect attempt fails.
*/
export async function connectDB(dsn = process.env.DSN) {
  /* Ensure DSN is provided */
  if (!dsn) {
    throw new Error('DSN is not set. Provide it as connectDB(dsn) or set process.env.DSN');
  }

  /* Modern strictQuery false keeps Mongoose query casting flexible */
  mongoose.set('strictQuery', false);

  /* Connect if not already connected */
  if (mongoose.connection.readyState === 0) {
    info('DB connect start', dsn);
    /* per query debug when MONGOOSE_DEBUG=1 */
    if (process.env.MONGOOSE_DEBUG === '1') {
      mongoose.set('debug', function (coll, method, query, doc, options) {
        info('DB', `${coll}.${method}`, JSON.stringify(query), doc ? JSON.stringify(doc) : '');
      });
    }

    await mongoose.connect(dsn, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10000,
    });
  }

  /* attach listeners only once */
  if (!hasAttachedConnectionListeners) {
    hasAttachedConnectionListeners = true;
    info('DB connected', mongoose.connection.host, mongoose.connection.name);
    /* basic connection lifecycle logs */
    mongoose.connection.on('error', (e) => err('DB error', e));
    mongoose.connection.on('disconnected', () => info('DB disconnected'));
    mongoose.connection.on('reconnected', () => info('DB reconnected'));
  }

  return mongoose.connection;
}

/* -------------------------------------------------------------------------- */
/* Shared subdocuments and enums                                              */
/* -------------------------------------------------------------------------- */

const PRIORITY_ENUM = ['low', 'normal', 'high'];

const LinkSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    attachmentId: { type: String, required: true },
    fileUrl: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/* Tag                                                                        */
/* -------------------------------------------------------------------------- */

const TagSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, trim: true },
  },
  { timestamps: true }
);

/* Unique tag names per user */
TagSchema.index({ userId: 1, name: 1 }, { unique: true });

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* one to one with User                                                       */
/* -------------------------------------------------------------------------- */

const SettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    theme: {
      type: String,
      enum: ['light', 'dark', 'custom'],
      default: 'light'
    },

    /* per status task colors */
    taskThemeDueColor:     { type: String, default: '#fff3b0' }, // yellow
    taskThemePastDueColor: { type: String, default: '#ffe5e5' }, // light red
    taskThemeDoneColor:    { type: String, default: '#e0f7e9' }, // green

    layoutOrder: { type: [String], default: ['Today', 'Scheduled', 'All'] },

    defaultReminderOffsetMinutes: { type: Number, default: 30, min: 0 },
    morningSummaryEmail: { type: Boolean, default: true },
    notifyHigh:   { type: Boolean, default: true },
    notifyNormal: { type: Boolean, default: false },
    notifyLow:    { type: Boolean, default: false },

    timezone: { type: String, default: 'America/New_York' },
    notificationChannels: {
      type: [String],
      default: ['email', 'push'],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.every(v => typeof v === 'string');
        },
        message: 'notificationChannels must be an array of strings',
      },
    },
  },
  { timestamps: true }
);



/* -------------------------------------------------------------------------- */
/* User and Login                                                             */
/* User holds account profile                                                 */
/* Login holds password sets history for rotation or audit                    */
/* -------------------------------------------------------------------------- */

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true, unique: true },
    /* Store the active password hash on User for fast lookup */
    passwordHash: { type: String, required: true },
    /* Optional profile fields */
    displayName: { type: String, trim: true },
  },
  { timestamps: true }
);

const LoginSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true }, // hash 
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* A container owned by a user                                                */
/* -------------------------------------------------------------------------- */

const ListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    title: { type: String, required: true, trim: true },
    icon: { type: String, trim: true },
    color: { type: String, trim: true },
    /* Basic sharing shape. Expand to a full ACL as needed */
    sharedWith: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['viewer', 'editor', 'owner'], default: 'viewer' },
      },
    ],
    position: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

/* One user cannot have two lists with the same title if we want uniqueness */
ListSchema.index({ userId: 1, title: 1 }, { unique: false });

/* -------------------------------------------------------------------------- */
/* Task                                                                       */
/* Flattened subtasks through parentTaskId                                    */
/* One to one fields section notes priority completion are in the same doc    */
/* -------------------------------------------------------------------------- */

const TaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', index: true, required: true },

    /* Subtasks are tasks with parentTaskId set to another task _id */
    parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },

    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },

    links: { type: [LinkSchema], default: [] },

    /* Tags are references to Tag */
    tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag', index: true }],

    priority: { type: String, enum: PRIORITY_ENUM, default: 'normal' },

    /* Dates */
    dueAt: { type: Date, default: null, index: true },
    startAt: { type: Date, default: null },
    repeatRule: { type: String, default: null },

    /* Reminders are relative offsets in minutes from dueAt or startAt */
    reminderOffsetsMinutes: {
      type: [Number],
      default: [],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.every(n => Number.isInteger(n) && n >= 0);
        },
        message: 'reminderOffsetsMinutes must be non negative integers',
      },
    },

    attachments: { type: [AttachmentSchema], default: [] },

    section: { type: String, default: null, trim: true },

    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: Date, default: null, index: true },

    position: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

/* Useful indexes */
TaskSchema.index({ listId: 1, parentTaskId: 1, position: 1 });
TaskSchema.index({ userId: 1, completed: 1, dueAt: 1 });

/* Text search across title and notes */
TaskSchema.index({ title: 'text', notes: 'text' });

/*
  isSubtask virtual

  Returns true when this Task has a parentTaskId which means the
  document represents a subtask of another Task rather than a top
  level task.
*/
TaskSchema.virtual('isSubtask').get(function () {
  return !!this.parentTaskId;
});


/* -------------------------------------------------------------------------- */
/* Derived progress helpers                                                   */
/* Progress is 0 to 100 out of done over total for a user or a list          */
/* These are static helpers we can call where needed                          */
/* -------------------------------------------------------------------------- */

/*
  getUserProgressPercent

  Computes completion percentage for all tasks owned by a given userId.

  - Groups tasks by userId with an aggregate pipeline.
  - Counts total tasks and tasks marked completed.
  - Returns an integer percent from 0 to 100, with 0 when the user
    has no tasks.

  Accepts either a string or ObjectId as userId and converts inside
  the aggregation pipeline.
*/
export async function getUserProgressPercent(userId) {
  /* Count tasks for the user and compute percent */
  const [counts] = await Task.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        done: { $sum: { $cond: ['$completed', 1, 0] } },
      },
    },
  ]);

  const total = counts?.total || 0;
  const done = counts?.done || 0;
  if (total === 0) return 0;
  return Math.round((done * 100) / total);
}

/*
  getListProgressPercent

  Computes completion percentage for all tasks attached to a given listId.

  - Filters tasks by listId with an aggregate pipeline.
  - Counts total tasks and completed tasks for that list.
  - Returns an integer percent from 0 to 100 with 0 when the list
    has no tasks.

  Accepts either a string or ObjectId as listId and converts inside
  the aggregation pipeline.
*/
export async function getListProgressPercent(listId) {
  /* Count tasks for the list and compute percent */
  const [counts] = await Task.aggregate([
    { $match: { listId: new mongoose.Types.ObjectId(listId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        done: { $sum: { $cond: ['$completed', 1, 0] } },
      },
    },
  ]);

  const total = counts?.total || 0;
  const done = counts?.done || 0;
  if (total === 0) return 0;
  return Math.round((done * 100) / total);
}

/* -------------------------------------------------------------------------- */
/* Settings helper                                                            */
/* Central default Settings template and helper to ensure one per user        */
/* -------------------------------------------------------------------------- */

const DEFAULT_SETTINGS = {
  theme: 'light',
  layoutOrder: ['Today', 'Scheduled', 'All'],
  defaultReminderOffsetMinutes: 30,
  morningSummaryEmail: true,
  timezone: 'America/New_York',
  notificationChannels: ['email'],
  taskThemeDueColor:     '#fff3b0',
  taskThemePastDueColor: '#ffe5e5',
  taskThemeDoneColor:    '#e0f7e9',
  notifyHigh:   true,
  notifyNormal: false,
  notifyLow:    false,
};

/*
  ensureSettingsForUser

  Guarantees that a Settings document exists for the given userId.

  - Looks up Settings by userId.
  - If found, returns the existing document.
  - If missing, creates a new Settings document using DEFAULT_SETTINGS
    merged with any overrides provided and returns that new document.

  This function is safe to call from routes and seed helpers so each
  user always has a usable settings record.
*/
export async function ensureSettingsForUser(userId, overrides = {}) {
  let settings = await Settings.findOne({ userId });
  if (!settings) {
    settings = await Settings.create({
      userId,
      ...DEFAULT_SETTINGS,
      ...overrides,  /* guest or demo can override small bits */
    });
  }
  return settings;
}

/* -----------------------------------------------------------------------
    Models                                                    
-------------------------------------------------------------------------- */

export const Login = mongoose.models.Login || mongoose.model('Login', LoginSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Tag = mongoose.models.Tag || mongoose.model('Tag', TagSchema);
export const Settings =
  mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
export const List = mongoose.models.List || mongoose.model('List', ListSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

/* -----------------------------------------------------------------------
    Exports                                                    
-------------------------------------------------------------------------- */
export default {
  connectDB,
  models: { User, Login, Settings, List, Tag, Task },
  helpers: { getUserProgressPercent, getListProgressPercent },
};

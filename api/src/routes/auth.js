/**
 * api/src/routes/auth.js
 * ──────────────────────
 * POST /api/auth/guest    — issue a guest JWT
 * POST /api/auth/otp      — request an OTP (mocked for demo: 123456)
 * POST /api/auth/verify   — verify OTP and issue a user JWT
 */
'use strict';

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { issueToken } = require('../middleware/auth');
const User = require('../models/User');
const { getStore, isFallback } = require('../db');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { error: 'Too many auth attempts. Try again later.' },
});
router.use(authLimiter);

// POST /api/auth/guest
router.post('/guest', async (req, res, next) => {
  try {
    const guestId = `guest_${uuidv4().substring(0, 8)}`;
    const token = issueToken({ userId: guestId, role: 'guest' });

    if (isFallback()) {
      getStore().users.push({ userId: guestId, role: 'guest', createdAt: new Date() });
    } else {
      await User.create({ userId: guestId, role: 'guest' });
    }

    return res.status(200).json({ token, userId: guestId, role: 'guest' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/otp
router.post('/otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  return res.status(200).json({ message: 'OTP sent (demo: use 123456)', phone });
});

// POST /api/auth/verify
router.post('/verify', async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'phone and otp are required' });
    if (otp !== '123456') return res.status(401).json({ error: 'Invalid OTP' });

    const userId = `user_${phone.replace(/\D/g, '')}`;
    const token = issueToken({ userId, phone, role: 'user' });

    if (isFallback()) {
      const store = getStore();
      let u = store.users.find(x => x.userId === userId);
      if (!u) {
        u = { userId, phone, role: 'user', createdAt: new Date() };
        store.users.push(u);
      }
    } else {
      await User.findOneAndUpdate(
        { userId },
        { userId, phone, role: 'user', lastActive: new Date() },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({ token, userId, role: 'user' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

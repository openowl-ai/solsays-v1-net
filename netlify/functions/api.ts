import { Handler } from '@netlify/functions';
import TelegramBot from 'node-telegram-bot-api';
import { config } from 'dotenv';
import { GameStateManager } from '../../src/game/managers/GameStateManager';
import { PatternController } from '../../src/game/controllers/PatternController';
import { ButtonController } from '../../src/game/controllers/ButtonController';
import { RewardSystem } from '../../src/game/utils/rewardSystem';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') }); // Load environment variables

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Telegram bot token is not set. Please set the TELEGRAM_BOT_TOKEN environment variable.');
  process.exit(1);
}

const bot = new TelegramBot(botToken);

// Initialize game state manager (you'll need to implement these classes)
const rewardSystem = new RewardSystem();
const patternController = new PatternController('novice');
const buttonController = new ButtonController(rewardSystem);
const gameStateManager = new GameStateManager(patternController, buttonController);

const handler: Handler = async (event, context) => {
  if (event.path === '/api/health') {
    try {
      const botInfo = await bot.getMe();
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'ok',
          game: 'solsays',
          telegram: {
            connected: true,
            botInfo,
            botToken: botToken ? '✓ Set' : '✗ Missing'
          }
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          status: 'error',
          message: 'Failed to connect to Telegram',
          error: error.message
        }),
      };
    }
  } else if (event.httpMethod === 'POST' && event.path === '/api/game/start') {
    const { difficulty } = JSON.parse(event.body || '{}');
    gameStateManager.reset();
    const newPattern = patternController.generateNewPattern(1);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, pattern: newPattern }),
    };
  } else if (event.httpMethod === 'GET' && event.path === '/api/game/state') {
    const gameState = gameStateManager.getGameState();
    return {
      statusCode: 200,
      body: JSON.stringify(gameState),
    };
  } else if (event.httpMethod === 'POST' && event.path === '/api/game/input') {
    const { input } = JSON.parse(event.body || '{}');
    gameStateManager.handleInput(input);
    const gameState = gameStateManager.getGameState();

    if (gameState.levelFailed) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, message: 'Level failed', state: gameState }),
      };
    } else if (gameState.levelCompleted) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Level completed', state: gameState }),
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, state: gameState }),
      };
    }
  } else if (event.httpMethod === 'POST' && event.path === '/api/score') {
    const { userId, score } = JSON.parse(event.body || '{}');
    try {
      await bot.setGameScore(userId, score, { force: true });
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      };
    } catch (error) {
      console.error('Error updating score:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update score' }),
      };
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: 'Not Found' }),
  };
};

export { handler };

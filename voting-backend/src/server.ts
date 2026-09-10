import { app } from './app.js';
import { env } from './config/index.js';
import { prisma } from './lib/prisma.js';
import { VoteService } from './services/vote.service.js';
import cron from 'node-cron';

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`====================================================`);
  console.log(`🚀 College Colors Voting API Service Started`);
  console.log(`📡 URL: http://${env.HOST}:${env.PORT}`);
  console.log(`⚙️  Environment: ${env.NODE_ENV}`);
  console.log(`📱 SMS Provider: ${env.SMS_PROVIDER}`);
  console.log(`====================================================`);
});

// Auto-expire votes lifecycle job: Runs every minute to guarantee timely closure of votes
const cronSchedule = cron.schedule('*/1 * * * *', async () => {
  try {
    const expiredCount = await VoteService.checkAndExpireVotesCron();
    if (expiredCount > 0) {
      console.log(`[Lifecycle Cron] Auto-ended ${expiredCount} expired vote(s) at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('[Lifecycle Cron Error]: Failed to check expired votes:', error);
  }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  
  // Stop background cron
  cronSchedule.stop();

  // Close HTTP server
  server.close(async () => {
    console.log('HTTP server closed.');
    
    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('Database connection closed.');
    
    process.exit(0);
  });

  // Force exit after timeout if shutdown hangs
  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

const { Sequelize } = require('sequelize');
import config from '../config/development';

const dbConfig = config.postgres;

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      connectionTimeout: 60000,
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: { max: 150, idle: 30 }
  }
);

const verifyConnection = async () => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    // do nothing — for now
  }
};

verifyConnection();

export default sequelize;

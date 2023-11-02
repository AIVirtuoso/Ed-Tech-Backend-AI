// models/HighlightComment.js
import Highlight from './highlights';
const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize';

export interface HighlightCommentType {
  content: string;
  highlightId: string;
  studentId: string;
}

const HighlightComment = sequelize.define('HighlightComment', {
  id: {
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  highlightId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false
  }
});

export default HighlightComment;

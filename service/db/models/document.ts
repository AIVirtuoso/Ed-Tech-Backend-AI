const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize';

interface Document {
  reference: string;
  title: string;
  referenceId: string;
  documentId: string;
  document?: JSON;
  courseId?: string;
  summary?: string;
  keywords?: JSON;
  documentURL: string;
}

const Document = sequelize.define('Document', {
  reference: {
    type: DataTypes.ENUM('student', 'shepherdtutors'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  referenceId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  documentURL: {
    type: DataTypes.STRING
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    defaultValue: DataTypes.UUIDV4
  },
  courseId: {
    type: DataTypes.STRING
  },
  summary: {
    type: DataTypes.TEXT
  },
  keywords: {
    type: DataTypes.JSONB
  }
});

export const retrieveDocument = async ({
  referenceId,
  documentId
}: {
  referenceId: string;
  documentId: string;
}): Promise<Document> => {
  const document = await Document.findOne({
    where: {
      referenceId,
      documentId
    },
    order: [['createdAt']]
  });

  return document;
};

export const deleteSummary = async ({
  referenceId,
  documentId
}: {
  referenceId: string;
  documentId: string;
}): Promise<any> => {
  await Document.update(
    {
      summary: null
    },
    {
      where: {
        referenceId,
        documentId
      }
    }
  );

  return true;
};

export const updateDocument = async ({
  referenceId,
  documentId,
  data
}: {
  referenceId: string;
  documentId: string;
  data: object;
}) => {
  const document = await Document.findOne({
    where: { documentId, referenceId }
  });

  if (!document)
    throw new Error(`No document present for user with id ${referenceId}`);

  await Document.update(data, {
    where: {
      referenceId,
      documentId
    }
  });
};

export const createOrUpdateDocument = async (data: Document) => {
  return await Document.upsert(data);
};

export default Document;

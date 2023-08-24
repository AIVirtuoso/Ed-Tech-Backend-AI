const paginatedFind = async (
  model: any,
  where: object,
  headers?: any,
  attributes?: Array<any>
) => {
  let paginationObject: any = {};

  if (headers?.limit) {
    paginationObject.limit = headers.limit;
  }

  if (headers?.offset) {
    paginationObject.offset = headers.offset;
  }

  return model.findAll({
    where,
    order: headers?.order || [['createdAt', 'DESC']],
    limit: paginationObject.limit,
    offset: paginationObject.offset,
    attributes
  });
};

export default paginatedFind;

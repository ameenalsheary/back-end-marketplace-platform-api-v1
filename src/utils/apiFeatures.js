class ApiFeatures {
  constructor(mongooseQuery, reqQuery) {
    this.mongooseQuery = mongooseQuery;
    this.reqQuery = reqQuery;
  }
  filter() {
    const queryStringObject = { ...this.reqQuery };
    const excludesFields = [`page`, `sort`, `limit`, `fields`, `search`];
    for (let i = 0; i < excludesFields.length; i++) {
      delete queryStringObject[excludesFields[i]];
    }
    let queryStr = JSON.stringify(queryStringObject);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );
    queryStr = JSON.parse(queryStr);
    this.mongooseQuery = this.mongooseQuery.find(queryStr);
    return this;
  }
  sort() {
    if (this.reqQuery.sort) {
      const sortBy = this.reqQuery.sort.split(",").join(" ");
      this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort(`-createdAt`);
    }
    return this;
  }
  limitFields(mudelName) {
    if (this.reqQuery.fields) {
      const fields = this.reqQuery.fields.split(",").join(" ");
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else if (mudelName === `User`) {
      this.mongooseQuery = this.mongooseQuery.select(`
        -emailVerificationCode
        -emailVerificationCodeExpires
        -password
        -passwordChangedAt
        -passwordResetCode
        -passwordResetExpires
        -isGoogleUser
      `);
    } else {
      this.mongooseQuery = this.mongooseQuery.select("-__v");
    }
    return this;
  }
  search(mudelName) {
    if (this.reqQuery.search) {
      let query = {};
      if (mudelName === `Product`) {
        query.$or = [
          { title: { $regex: this.reqQuery.search, $options: `i` } },
          { description: { $regex: this.reqQuery.search, $options: `i` } },
        ];
      } else if (mudelName === `User`) {
        query = {
          slug: {
            $regex: `${this.reqQuery.search}`.replaceAll(" ", "-"),
            $options: `i`,
          },
        };
      } else {
        query = { name: { $regex: this.reqQuery.search, $options: `i` } };
      }
      this.mongooseQuery = this.mongooseQuery.find(query);
    }
    return this;
  }
  paginate(countDocuments) {
    const page = this.reqQuery.page * 1 || 1;
    const limit = this.reqQuery.limit * 1 || 50;
    const skip = (page - 1) * limit;
    const endIndex = page * limit;

    // Pagination results
    const pagination = {};
    pagination.currentPage = page;
    pagination.limit = limit;
    pagination.numberOfPages = Math.ceil(countDocuments / limit);

    if (endIndex < countDocuments) {
      pagination.nextPage = page + 1;
    }
    if (page > 1) {
      pagination.prevPage = page - 1;
    }
    this.paginationResults = pagination;

    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);

    return this;
  }
}

module.exports = ApiFeatures;

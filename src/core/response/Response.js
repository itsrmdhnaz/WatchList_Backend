export default class Response {
  static success(data = {}, { message = 'Success', meta } = {}) {
    const response = {
      success: true,
      message,
      data,
    };

    if (meta !== undefined) {
      response.meta = meta;
    }

    return response;
  }
}

// @ts-ignore
const errorMiddleware = async (err, req, res, next) => {
    let message = err?.message || JSON.stringify(err?.message);
    const statusCode = err?.statusCode || 400;
    res.status(statusCode).send({
        statusCode,
        message: message ?? 'Something went wrong. Check your request and try again.'
    });
};
export default errorMiddleware;

const validate = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers
        });
        return next();
    }
    catch (error) {
        return res.status(400).json(error);
    }
};
export default validate;

import xss from 'xss';

const options = {
  whiteList: {}, // Empty whitelist means ALL HTML tags are stripped.
  stripIgnoreTag: true, // Remove tags that are not in the whitelist.
  stripIgnoreTagBody: ['script'] // Remove both the tag and its content for <script>.
};

const myXss = new xss.FilterXSS(options);

const sanitizeValue = (value, parentKey = null) => {
  // Do not sanitize HTML template content fields
  if (parentKey === 'html_content' || parentKey === 'template') {
    return value;
  }

  if (typeof value === 'string') {
    return myXss.process(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, parentKey));
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitizedObj[key] = sanitizeValue(value[key], key);
      }
    }
    return sanitizedObj;
  }
  return value;
};

export const sanitizeInput = (req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

import fs from 'node:fs';
import path from 'node:path';
import webpack from 'webpack';
import getPublicLibConfig from '../../webpack.config.js';
import { isBunRuntime } from '../runtime.js';

export default function getWebpackServeMiddleware({ forceDist = false } = {}) {
    const resolvePublicLibConfig = ({ forceDist: overrideForceDist = forceDist, pruneCache = false } = {}) =>
        getPublicLibConfig({ forceDist: overrideForceDist, pruneCache });

    /**
     * A very spartan recreation of webpack-dev-middleware.
     * @param {import('express').Request} req Request object.
     * @param {import('express').Response} res Response object.
     * @param {import('express').NextFunction} next Next function.
     * @type {import('express').RequestHandler}
     */
    function devMiddleware(req, res, next) {
        const publicLibConfig = resolvePublicLibConfig();
        const outputPath = publicLibConfig.output?.path;
        const outputFile = publicLibConfig.output?.filename;
        const parsedPath = path.parse(req.path);

        if (req.method === 'GET' && parsedPath.dir === '/' && parsedPath.base === outputFile) {
            return res.sendFile(outputFile, { root: outputPath });
        }

        next();
    }

    /**
     * Wait until Webpack is done compiling.
     * @param {object} param Parameters.
     * @param {boolean} [param.forceDist=forceDist] Whether to force the use the /dist folder.
     * @param {boolean} [param.pruneCache=false] Whether to prune old cache directories before compiling.
     * @returns {Promise<void>}
     */
    devMiddleware.runWebpackCompiler = ({ forceDist: overrideForceDist = forceDist, pruneCache = false } = {}) => {
        const publicLibConfig = resolvePublicLibConfig({ forceDist: overrideForceDist, pruneCache });
        const outputPath = publicLibConfig.output?.path;
        const outputFile = publicLibConfig.output?.filename;
        const compiledOutputPath = typeof outputPath === 'string' && typeof outputFile === 'string'
            ? path.join(outputPath, outputFile)
            : null;

        if (isBunRuntime() && compiledOutputPath && fs.existsSync(compiledOutputPath)) {
            console.log();
            console.log('Reusing precompiled frontend libraries...');
            return Promise.resolve();
        }

        console.log();
        console.log('Compiling frontend libraries...');

        const compiler = webpack(publicLibConfig);

        return new Promise((resolve) => {
            compiler.run((_error, stats) => {
                const output = stats?.toString(publicLibConfig.stats);
                if (output) {
                    console.log(output);
                    console.log();
                }
                compiler.close(() => {
                    resolve();
                });
            });
        });
    };

    return devMiddleware;
}

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema, TypeOf } from '@kbn/config-schema';
import { Ensure } from '@kbn/utility-types';
import { Readable } from 'stream';

import type { DownloadFileKindHttpEndpoint } from '../../../common/api_routes';
import type { FileKind } from '../../../common/types';
import { fileNameWithExt } from '../common_schemas';
import { fileErrors } from '../../file';
import { getDownloadHeadersForFile } from '../common';
import { getById } from './helpers';
import type { FileKindRouter, FileKindsRequestHandler } from './types';
import { FILES_API_ROUTES } from '../api_routes';

export const method = 'get' as const;

export const paramsSchema = schema.object({
  id: schema.string(),
  fileName: schema.maybe(fileNameWithExt),
});

type Params = Ensure<DownloadFileKindHttpEndpoint['inputs']['params'], TypeOf<typeof paramsSchema>>;

type Response = Readable;

export const handler: FileKindsRequestHandler<Params, unknown, Body> = async (
  { files, fileKind },
  req,
  res
) => {
  const { fileService } = await files;
  const {
    params: { id, fileName },
  } = req;
  const { error, result: file } = await getById(fileService.asCurrentUser(), id, fileKind);
  if (error) return error;
  try {
    const body: Response = await file.downloadContent();
    return res.ok({
      body,
      headers: getDownloadHeadersForFile(file, fileName),
    });
  } catch (e) {
    if (e instanceof fileErrors.NoDownloadAvailableError) {
      return res.notFound({ body: { message: e.message } });
    }
    throw e;
  }
};

export function register(fileKindRouter: FileKindRouter, fileKind: FileKind) {
  if (fileKind.http.download) {
    fileKindRouter[method](
      {
        path: FILES_API_ROUTES.fileKind.getDownloadRoute(fileKind.id),
        validate: {
          params: paramsSchema,
        },
        options: {
          tags: fileKind.http.download.tags,
        },
      },
      handler
    );
  }
}

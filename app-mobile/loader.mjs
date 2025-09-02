import { pathToFileURL } from 'url';
import { readFileSync } from 'fs';
import { transformSync } from '@babel/core';

export async function load(url, context, defaultLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = readFileSync(new URL(url), 'utf8');
    const { code } = transformSync(source, {
      filename: url,
      presets: ['@babel/preset-typescript'],
      plugins: []
    });
    return {
      format: 'module',
      source: code,
    };
  }
  return defaultLoad(url, context, defaultLoad);
}

export async function resolve(specifier, context, defaultResolve) {
  return defaultResolve(specifier, context, defaultResolve);
}
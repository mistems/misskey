/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL } from 'url';
import Parser from 'rss-parser';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

const rssParser = new Parser();

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 3, // ASK: これどう振る舞うの？

	res: {
		type: 'object',
		properties: {
			image: {
				type: 'object',
				optional: true,
				properties: {
					link: {
						type: 'string',
						optional: true,
					},
					url: {
						type: 'string',
						optional: false,
					},
					title: {
						type: 'string',
						optional: true,
					},
				},
			},
			paginationLinks: {
				type: 'object',
				optional: true,
				properties: {
					self: {
						type: 'string',
						optional: true,
					},
					first: {
						type: 'string',
						optional: true,
					},
					next: {
						type: 'string',
						optional: true,
					},
					last: {
						type: 'string',
						optional: true,
					},
					prev: {
						type: 'string',
						optional: true,
					},
				},
			},
			link: {
				type: 'string',
				optional: true,
			},
			title: {
				type: 'string',
				optional: true,
			},
			items: {
				type: 'array',
				optional: false,
				items: {
					type: 'object',
					properties: {
						link: {
							type: 'string',
							optional: true,
						},
						guid: {
							type: 'string',
							optional: true,
						},
						title: {
							type: 'string',
							optional: true,
						},
						pubDate: {
							type: 'string',
							optional: true,
						},
						creator: {
							type: 'string',
							optional: true,
						},
						summary: {
							type: 'string',
							optional: true,
						},
						content: {
							type: 'string',
							optional: true,
						},
						isoDate: {
							type: 'string',
							optional: true,
						},
						categories: {
							type: 'array',
							optional: true,
							items: {
								type: 'string',
							},
						},
						contentSnippet: {
							type: 'string',
							optional: true,
						},
						enclosure: {
							type: 'object',
							optional: true,
							properties: {
								url: {
									type: 'string',
									optional: false,
								},
								length: {
									type: 'number',
									optional: true,
								},
								type: {
									type: 'string',
									optional: true,
								},
							},
						},
					},
				},
			},
			feedUrl: {
				type: 'string',
				optional: true,
			},
			description: {
				type: 'string',
				optional: true,
			},
			itunes: {
				type: 'object',
				optional: true,
				additionalProperties: true,
				properties: {
					image: {
						type: 'string',
						optional: true,
					},
					owner: {
						type: 'object',
						optional: true,
						properties: {
							name: {
								type: 'string',
								optional: true,
							},
							email: {
								type: 'string',
								optional: true,
							},
						},
					},
					author: {
						type: 'string',
						optional: true,
					},
					summary: {
						type: 'string',
						optional: true,
					},
					explicit: {
						type: 'string',
						optional: true,
					},
					categories: {
						type: 'array',
						optional: true,
						items: {
							type: 'string',
						},
					},
					keywords: {
						type: 'array',
						optional: true,
						items: {
							type: 'string',
						},
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		url: { type: 'string' },
	},
	required: ['url'],
} as const;

const isValidUrl = (urlString: string) => {
	try { 
		return Boolean(new URL(urlString)); 
	} catch (e) { 
		return false; 
	}
};

function createErrResponse(url: string, msg: string): Parser.Output<Parser.Item> {
	console.log('[FetchRSS INFO]', url, msg);
	return {
		description: 'リクエスト失敗',
		title: url,
		items: [
			{ title: msg, content: '', link: ''	},
		],
		link: '',
	};
}

const unstableUrl : Record<string, number> = {};

function incrementUnstableUrl(url: string) {
	if (unstableUrl[url]) {
		unstableUrl[url]++;
	} else {
		unstableUrl[url] = 1;
	}
	console.error('[fetch-rss INFO]' + url + ' is failed ' + unstableUrl[url] + ' times' );
}

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private httpRequestService: HttpRequestService,
	) {
		super(meta, paramDef, async (ps, _me) => {
			if (!isValidUrl(ps.url)) {
				incrementUnstableUrl(ps.url);
				return await createErrResponse(ps.url, '入力がURLではありません');
			}

			try {
				const res = await this.httpRequestService.send(ps.url, {
					method: 'GET',
					headers: {
						Accept: 'application/rss+xml, */*',
					},
					timeout: 5000,
				});
				if (unstableUrl[ps.url] && unstableUrl[ps.url] > 5) {
					incrementUnstableUrl(ps.url);
 					return await createErrResponse(ps.url, 'このURLはRSSのURLではないかも');
				}

				const text = await res.text();
				return await rssParser.parseString(text);
			} catch (err ) {
				incrementUnstableUrl(ps.url);
				if (err.message.match('nvalid character in entity name')) {
					return await createErrResponse(ps.url, 'URLはRSSではありません');	
				}
				if (err.code === 'ENOTFOUND') {
					return await createErrResponse(ps.url, 'URLが間違っています');	
				}

				return await createErrResponse(ps.url, err.message as string);
			};
		});
	}
}

import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'Facebook',
    url: 'facebook.com',
    description: `Authentication:

It is recommended to use a non-important account for \`FACEBOOK_COOKIES\`. Must include \`c_user\` and \`xs\` cookie according to [Meta Cookies Policy](https://www.facebook.com/privacy/policies/cookies/?subpage=subpage-1.1).

Common options for \`routeParams\` query string

| Key           | Description                   | Accepts                        | Defaults value |
| ------------- | ----------------------------- | ------------------------------ | -------------- |
| \`textOnly\`  | Description only contain text | \`0\`/\`1\`/\`true\`/\`false\` | \`false\`      |
`,
};

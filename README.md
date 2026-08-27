# @jojovembh/cognito-cli-helper

**A CLI to easily test AWS Cognito user functionalities.**

## Features

- Configure AWS Cognito credentials, including a stored username/password (`configure`)
- Create users with temporary passwords (`create-user`)
- Login with SRP challenge support — email/password optional once stored (`login`)
- Copy a user's `IdToken` straight to the clipboard (`get-id-token`)
- Delete users (`delete-user`)
- Logout / revoke access tokens (`invalidate-token`)

## Installation

```bash
  npm install -g @jojovembh/cognito-cli-helper
```

## Configuration

```bash
  cognito-cli configure
```

Enter region, userPoolId, clientId, optionally awsProfile, and a Cognito
username (email) and password.

The non-secret config is written to `~/.config/cognito-cli-helper/config.json`,
and the credentials are written as plain `KEY=value` lines to
`~/.config/cognito-cli-helper/.env`. Once stored, `login` and `get-id-token` no
longer need the email/password passed on the command line.

## Usage

```bash
  cognito-cli create-user user@example.com [temporaryPassword]
  cognito-cli login [user@example.com]
  cognito-cli get-id-token [user@example.com] [password]
  cognito-cli delete-user user@example.com
  cognito-cli invalidate-token <accessToken>
```

`get-id-token` runs the same login flow as `login`, copies the resulting
`IdToken` to the system clipboard, and prints a confirmation. Command-line
arguments override the values stored in `.env`; if no credentials are available
from either source it prints usage guidance and exits non-zero.

## Contributing

1. Clone repo:

```bash
  git clone https://github.com/jojovem/cognito-cli-helper.git
  cd cognito-cli-helper
```

2. Install dependencies:

```bash
  npm install
```

3. Run tests:

```bash
  npm test
```

3. Build:

```bash
  npm run build
```

## License
MIT © Gustavo Andrade Ferreira

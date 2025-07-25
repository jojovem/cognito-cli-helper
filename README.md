# @jojovembh/cognito-cli-helper

**A CLI to easily test AWS Cognito user functionalities.**

## Features

- Configure AWS Cognito credentials (`configure`)
- Create users with temporary passwords (`create-user`)
- Login with SRP challenge support (`login`)
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

Enter region, userPoolId, clientId, and optionally awsProfile.

The file will be created on:`~/.config/congito-cli-helper/config.json`

## Usage

```bash
  cognito-cli create-user user@example.com [temporaryPassword]
  cognito-cli login user@example.com
  cognito-cli delete-user user@example.com
  cognito-cli invalidate-token <accessToken>
```

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

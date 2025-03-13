export const idlFactory = ({ IDL }) => {
  const Wallet = IDL.Record({
    'ckbtc_address': IDL.Text,
    'icp_address': IDL.Text,
    'ibtc_address': IDL.Text,
  });
  return IDL.Service({
    'create_wallet_for_user': IDL.Func([], [IDL.Variant({ 'Ok': Wallet, 'Err': IDL.Text })], []),
    'fetch_wallet': IDL.Func([], [IDL.Opt(Wallet)], ['query']),
    'get_user_profile': IDL.Func([], [IDL.Opt(IDL.Record({ 'user_id': IDL.Nat64, 'name': IDL.Text }))], ['query']),
    'get_user_profile_with_wallet': IDL.Func(
      [],
      [IDL.Opt(IDL.Record({ 'user_id': IDL.Nat64, 'name': IDL.Text, 'wallet': IDL.Opt(Wallet) }))],
      ['query']
    ),
    'get_wallet': IDL.Func([], [IDL.Opt(Wallet)], ['query']),
    'icp_to_usd_rate': IDL.Func([], [IDL.Variant({ 'Ok': IDL.Float64, 'Err': IDL.Text })], []),
    'register_user': IDL.Func([], [IDL.Record({ 'user_id': IDL.Nat64, 'name': IDL.Opt(IDL.Text) })], []),
    'set_user_name': IDL.Func([IDL.Text], [IDL.Variant({ 'Ok': IDL.Null, 'Err': IDL.Text })], []),
    'record_deposit': IDL.Func([IDL.Nat64, IDL.Nat64], [IDL.Variant({ 'Ok': IDL.Float64, 'Err': IDL.Text })], []),
    'transform': IDL.Func(
      [IDL.Record({
        'context': IDL.Vec(IDL.Nat8),
        'response': IDL.Record({
          'status': IDL.Nat16,
          'body': IDL.Vec(IDL.Nat8),
          'headers': IDL.Vec(IDL.Tuple([IDL.Text, IDL.Text])),
        }),
      })],
      [IDL.Record({
        'status': IDL.Nat16,
        'body': IDL.Vec(IDL.Nat8),
        'headers': IDL.Vec(IDL.Tuple([IDL.Text, IDL.Text])),
      })],
      ['query']
    ),
  });
};
export const init = ({ IDL }) => { return []; };
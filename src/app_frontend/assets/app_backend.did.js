export const idlFactory = ({ IDL }) => {
  const Wallet = IDL.Record({
    'ckbtc_address' : IDL.Text,
    'icp_address' : IDL.Text,
    'ibtc_address' : IDL.Text,
  });
  return IDL.Service({
    'create_wallet_for_user' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : Wallet, 'Err' : IDL.Text })],
        [],
      ),
    'get_user_profile' : IDL.Func(
        [],
        [IDL.Opt(IDL.Tuple(IDL.Nat64, IDL.Text))],
        ['query'],
      ),
    'get_user_profile_with_wallet' : IDL.Func(
        [],
        [IDL.Opt(IDL.Tuple(IDL.Nat64, IDL.Text, IDL.Opt(Wallet)))],
        ['query'],
      ),
    'get_wallet' : IDL.Func([], [IDL.Opt(Wallet)], ['query']),
    'register_user' : IDL.Func([], [IDL.Nat64, IDL.Opt(IDL.Text)], []),
    'set_user_name' : IDL.Func(
        [IDL.Text],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };

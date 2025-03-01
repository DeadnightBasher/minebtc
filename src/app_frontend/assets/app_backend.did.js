export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'get_user_profile' : IDL.Func(
        [],
        [IDL.Opt(IDL.Tuple(IDL.Nat64, IDL.Text))],
        ['query'],
      ),
    'register_user' : IDL.Func([], [IDL.Nat64, IDL.Opt(IDL.Text)], []),
    'set_user_name' : IDL.Func(
        [IDL.Text],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };

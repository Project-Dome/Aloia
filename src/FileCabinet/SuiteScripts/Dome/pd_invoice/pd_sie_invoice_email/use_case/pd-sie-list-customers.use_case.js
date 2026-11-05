/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Use case: lista os clientes ativos com o Customer Invoice Email.
 */
define(['../service/pd-sie-customer.service'], function (customerService) {

    function execute() {
        return customerService.listActiveCustomers();
    }

    return { execute: execute };
});

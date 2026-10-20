<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InitialScopeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\MergedContributionsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupPageConfigInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupUrlsInterface;
use Magento\Framework\Data\Form\FormKey;
use Magento\Framework\Locale\ResolverInterface;

/**
 * Assembles the page configuration from the settings' state, the contributions, the admin addresses, the session's
 * form key and the locale the admin user works in
 *
 * The state is read once, and the scope tree it carries is the one the addresses and the initial scope are built for,
 * so every scope the browser can reach has its addresses.
 */
class SetupPageConfig implements SetupPageConfigInterface
{
    /**
     * @param SetupStateProviderInterface $stateProvider
     * @param MergedContributionsInterface $contributions
     * @param SetupUrlsInterface $urls
     * @param InitialScopeInterface $initialScope
     * @param FormKey $formKey
     * @param ResolverInterface $localeResolver The admin user's interface locale in the admin area
     */
    public function __construct(
        private readonly SetupStateProviderInterface $stateProvider,
        private readonly MergedContributionsInterface $contributions,
        private readonly SetupUrlsInterface $urls,
        private readonly InitialScopeInterface $initialScope,
        private readonly FormKey $formKey,
        private readonly ResolverInterface $localeResolver
    ) {
    }

    /**
     * @inheritDoc
     */
    public function build(mixed $website, mixed $store): array
    {
        $state = $this->stateProvider->getState();
        $phrases = $this->contributions->getPhrases();
        $extensions = $this->contributions->getExtensionData();

        return [
            'endpoints' => $this->urls->getEndpoints($state['scopes']),
            'formKey' => $this->formKey->getFormKey(),
            'locale' => $this->localeResolver->getLocale(),
            'phrases' => $phrases === [] ? (object) [] : $phrases,
            'plugins' => $this->contributions->getPlugins(),
            'initialScope' => $this->initialScope->resolve($website, $store, $state['scopes']),
            'state' => $state,
            'extensions' => $extensions === [] ? (object) [] : $extensions,
        ];
    }
}
